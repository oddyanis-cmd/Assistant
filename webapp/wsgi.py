"""WSGI entry point for hosting (e.g. PythonAnywhere).

On PythonAnywhere, point the web app's WSGI file at this module's ``application``.
"""

import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from webapp.app import app as application  # noqa: E402

if __name__ == "__main__":
    application.run()
