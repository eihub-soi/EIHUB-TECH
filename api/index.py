import sys
import os

# Add backend directory to path to allow absolute imports
sys.path.append(os.path.join(os.path.dirname(__file__), "..", "backend"))
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from app.main import app
