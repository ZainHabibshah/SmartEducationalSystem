from flask import Blueprint

# Create Blueprint
news_bp = Blueprint("news", __name__)

from . import routes
