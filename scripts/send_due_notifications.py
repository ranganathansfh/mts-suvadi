import os
import json
from datetime import datetime
from zoneinfo import ZoneInfo
from collections import defaultdict

import firebase_admin
from firebase_admin import credentials, firestore, messaging


PROJECT_ID = "mts-suvadi-cbc08"
TIME_ZONE = "America/Detroit"


# ============================================================
# FIREBASE INITIALIZATION
# ============================================================

firebase_json = os.environ.get("FIREBASE_SERVICE_ACCOUNT")

if not firebase_json:
    raise RuntimeError(
        "FIREBASE_SERVICE_ACCOUNT GitHub secret is missing."
    )

service_account_info = json.loads(firebase_json)

cred = credentials.Certificate(service_account_info)

firebase_admin.initialize_app(
    cred,
    {
        "projectId": PROJECT_ID
    }
)

db = firestore.client()


# ============================================================
# TODAY - MICHIGAN LOCAL DATE
# ============================================================

# TEMPORARY TEST DATE
today_string = "2026-10-10"

print(f"MTS Suvadi notification date: {today_string}")


# ============================================================
# FIND BOOKS DUE TODAY
# ============================================================

due_books = (
    db.collection("lending")
      .where(
          filter=firestore.FieldFilter(
              "dateToReturn",
              "==",
              today_string
          )
      )
      .stream()
)


# family_books:
#
# parentEmail
#     -> studentId
#          name
#          count
#
family_books = defaultdict(
    lambda: defaultdict(
        lambda: {
            "name": "",
            "count": 0
        }
    )
)


book_count = 0


for doc in due_books:

    book = doc.to_dict()

    # Ignore already-returned books
    if book.get("returned") is True:
        continue

    parent_email = (
        book.get("parentEmail") or ""
    ).strip().lower()

    student_id = str(
        book.get("studentId") or ""
    ).strip()

    student_name = (
        book.get("studentName") or "Student"
    ).strip()

    if not parent_email or not student_id:
        continue

    family_books[parent_email][student_id]["name"] = (
        student_name
    )

    family_books[parent_email][student_id]["count"] += 1

    book_count += 1


print(f"Books due today: {book_count}")
print(f"Families with books due: {len(family_books)}")


if not family_books:
    print("No due notifications to send.")
    raise SystemExit(0)


# ============================================================
# LOAD ENABLED NOTIFICATION DEVICES
# ============================================================

devices = (
    db.collection("notificationDevices")
      .where(
          filter=firestore.FieldFilter(
              "enabled",
              "==",
              True
          )
      )
      .stream()
)


devices_by_family = defaultdict(list)


for doc in devices:

    device = doc.to_dict()

    parent_email = (
        device.get("parentEmail") or ""
    ).strip().lower()

    token = (
        device.get("token") or ""
    ).strip()

    if parent_email and token:
        devices_by_family[parent_email].append(token)


# ============================================================
# BUILD + SEND FAMILY NOTIFICATIONS
# ============================================================

success_count = 0
failure_count = 0
family_count = 0


for parent_email, students in family_books.items():

    tokens = devices_by_family.get(
        parent_email,
        []
    )

    if not tokens:

        print(
            f"No registered device for family: "
            f"{parent_email}"
        )

        continue


    # --------------------------------------------------------
    # BUILD MESSAGE
    # --------------------------------------------------------

    lines = []

    for student in students.values():

        name = student["name"]
        count = student["count"]

        if count == 1:
            lines.append(
                f"{name} has 1 book due today."
            )
        else:
            lines.append(
                f"{name} has {count} books due today."
            )


    lines.append(
        "Please remember to bring them to Tamil School."
    )


    body = "\n".join(lines)


    # --------------------------------------------------------
    # SEND TO EVERY REGISTERED DEVICE FOR THIS FAMILY
    # --------------------------------------------------------

    for token in set(tokens):

        message = messaging.Message(

            notification=messaging.Notification(
                title="📚 MTS சுவடி – Books Due Today",
                body=body
            ),

            data={
                "url":
                    "https://ranganathansfh.github.io/mts-suvadi/"
            },

            token=token
        )


        try:

            response = messaging.send(message)

            success_count += 1

            print(
                f"Sent to {parent_email}: {response}"
            )

        except Exception as error:

            failure_count += 1

            print(
                f"FAILED for {parent_email}: {error}"
            )


    family_count += 1


# ============================================================
# SUMMARY
# ============================================================

print()
print("============================================")
print("MTS SUVADI DUE NOTIFICATION SUMMARY")
print("============================================")
print(f"Date              : {today_string}")
print(f"Due books         : {book_count}")
print(f"Due families      : {len(family_books)}")
print(f"Families processed: {family_count}")
print(f"Messages sent     : {success_count}")
print(f"Messages failed   : {failure_count}")
print("============================================")
