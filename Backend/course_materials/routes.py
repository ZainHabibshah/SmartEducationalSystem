"""
Admin uploads for course books/slides (PDF, DOCX, PPTX) → chunked embeddings in per-course Chroma folders.
"""
import json
import os
import traceback
import uuid
from datetime import datetime, timezone

from flask import Blueprint, current_app, jsonify, request, send_file
from flask_jwt_extended import get_jwt_identity, jwt_required
from werkzeug.utils import secure_filename

from chatbot.rag_pipeline import MAX_COURSE_MATERIAL_FILES, VALID_COURSE_KEYS

course_materials_bp = Blueprint("course_materials", __name__)

ALLOWED_EXT = {".pdf", ".docx", ".pptx"}


def _allowed_filename(name: str) -> bool:
    if not name:
        return False
    return os.path.splitext(name)[1].lower() in ALLOWED_EXT


def _manifest_path(course_key: str) -> str:
    root = current_app.config["COURSE_MATERIALS_UPLOAD_FOLDER"]
    return os.path.join(root, course_key, "manifest.json")


def _load_manifest(course_key: str):
    path = _manifest_path(course_key)
    if not os.path.isfile(path):
        return []
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []


def _save_manifest(course_key: str, entries):
    path = _manifest_path(course_key)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(entries, f, indent=2)


def _evict_oldest_course_materials(course_key: str, pipeline) -> None:
    """Keep at most MAX_COURSE_MATERIAL_FILES - 1 entries before a new upload is added."""
    manifest = _load_manifest(course_key)
    folder = os.path.join(current_app.config["COURSE_MATERIALS_UPLOAD_FOLDER"], course_key)
    while len(manifest) >= MAX_COURSE_MATERIAL_FILES:
        manifest.sort(key=lambda e: e.get("uploaded_at") or "")
        victim = manifest.pop(0)
        save_name = victim.get("saved_as")
        if save_name:
            fp = os.path.join(folder, save_name)
            try:
                if os.path.isfile(fp):
                    os.remove(fp)
            except Exception as ex:
                print(f"⚠️ Could not remove evicted course material {fp}: {ex}")
        sid = victim.get("storage_id")
        if sid:
            pipeline.delete_course_material_vectors(course_key, sid)
    _save_manifest(course_key, manifest)


@course_materials_bp.route("/upload", methods=["POST"])
@jwt_required()
def upload_course_material():
    from chatbot.routes import get_rag_pipeline

    try:
        user = get_jwt_identity()
        if user.get("role") != "admin":
            return jsonify({"error": "Only admin can upload course materials"}), 403

        course = (request.form.get("course") or user.get("course") or "").strip()
        if course not in VALID_COURSE_KEYS:
            return jsonify(
                {"error": "Invalid or missing course. Use computerScience, chemistry, or physics."}
            ), 400

        admin_course = user.get("course")
        if admin_course and admin_course != course:
            return jsonify({"error": "You may only upload materials for your assigned course."}), 403

        if "file" not in request.files:
            return jsonify({"error": "No file provided"}), 400
        file = request.files["file"]
        if not file.filename:
            return jsonify({"error": "Empty filename"}), 400
        if not _allowed_filename(file.filename):
            return jsonify({"error": "Only PDF, DOCX, and PPTX are allowed"}), 400

        storage_id = uuid.uuid4().hex
        orig = secure_filename(file.filename)
        save_name = f"{storage_id}_{orig}"
        folder = os.path.join(current_app.config["COURSE_MATERIALS_UPLOAD_FOLDER"], course)
        os.makedirs(folder, exist_ok=True)
        filepath = os.path.join(folder, save_name)
        file.save(filepath)

        pipeline = get_rag_pipeline()
        ing = pipeline.ingest_course_material_file(
            course_key=course,
            file_path=filepath,
            original_filename=orig,
            storage_id=storage_id,
        )
        if not ing.get("success"):
            try:
                os.remove(filepath)
            except Exception:
                pass
            return jsonify({"success": False, "error": ing.get("error", "ingest_failed")}), 400

        _evict_oldest_course_materials(course, pipeline)

        manifest = _load_manifest(course)
        manifest.append(
            {
                "storage_id": storage_id,
                "original_filename": orig,
                "saved_as": save_name,
                "course": course,
                "chunks": ing.get("chunks", 0),
                "uploaded_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            }
        )
        _save_manifest(course, manifest)

        return jsonify(
            {
                "success": True,
                "storage_id": storage_id,
                "chunks": ing.get("chunks"),
                "course": course,
                "filename": orig,
            }
        ), 200
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@course_materials_bp.route("/download/<course_key>/<storage_id>", methods=["GET"])
@jwt_required()
def download_course_material(course_key, storage_id):
    """Students/admins download an uploaded course file; JWT course must match the file's course."""
    user = get_jwt_identity()
    if course_key not in VALID_COURSE_KEYS:
        return jsonify({"error": "Invalid course"}), 400
    if not storage_id or len(storage_id) > 64:
        return jsonify({"error": "Invalid file id"}), 400

    role = user.get("role")
    if role not in ("admin", "student"):
        return jsonify({"error": "Unauthorized"}), 403

    user_course = (user.get("course") or "").strip()
    if user_course and user_course != course_key:
        return jsonify({"error": "You can only access materials for your own course."}), 403
    if not user_course:
        return jsonify({"error": "No course on your account."}), 403

    manifest = _load_manifest(course_key)
    entry = next((e for e in manifest if e.get("storage_id") == storage_id), None)
    if not entry:
        return jsonify({"error": "File not found"}), 404

    folder = os.path.join(current_app.config["COURSE_MATERIALS_UPLOAD_FOLDER"], course_key)
    save_name = entry.get("saved_as")
    if not save_name:
        return jsonify({"error": "Invalid manifest entry"}), 404

    filepath = os.path.join(folder, save_name)
    if not os.path.isfile(filepath):
        return jsonify({"error": "File missing on server"}), 404

    download_name = entry.get("original_filename") or save_name
    ext = os.path.splitext(download_name)[1].lower()
    mimetype_map = {
        ".pdf": "application/pdf",
        ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    }
    mimetype = mimetype_map.get(ext, "application/octet-stream")

    return send_file(filepath, as_attachment=True, download_name=download_name, mimetype=mimetype)


@course_materials_bp.route("/list", methods=["GET"])
@jwt_required()
def list_course_materials():
    user = get_jwt_identity()
    if user.get("role") != "admin":
        return jsonify({"error": "Only admin"}), 403
    course = (request.args.get("course") or user.get("course") or "").strip()
    if course not in VALID_COURSE_KEYS:
        return jsonify({"error": "Specify a valid ?course= computerScience|chemistry|physics"}), 400
    if user.get("course") and user.get("course") != course:
        return jsonify({"error": "Forbidden for this course"}), 403
    return jsonify({"success": True, "files": _load_manifest(course)}), 200


@course_materials_bp.route("/delete", methods=["DELETE"])
@jwt_required()
def delete_course_material():
    from chatbot.routes import get_rag_pipeline

    user = get_jwt_identity()
    if user.get("role") != "admin":
        return jsonify({"error": "Only admin"}), 403
    course = (request.args.get("course") or "").strip()
    storage_id = (request.args.get("storage_id") or "").strip()
    if course not in VALID_COURSE_KEYS or not storage_id:
        return jsonify({"error": "course and storage_id query parameters are required"}), 400
    if user.get("course") and user.get("course") != course:
        return jsonify({"error": "Forbidden"}), 403

    manifest = _load_manifest(course)
    entry = next((e for e in manifest if e.get("storage_id") == storage_id), None)
    if not entry:
        return jsonify({"error": "Not found"}), 404

    folder = os.path.join(current_app.config["COURSE_MATERIALS_UPLOAD_FOLDER"], course)
    save_name = entry.get("saved_as")
    if save_name:
        fp = os.path.join(folder, save_name)
        try:
            if os.path.isfile(fp):
                os.remove(fp)
        except Exception as ex:
            print(f"⚠️ Could not remove course material file {fp}: {ex}")

    pipeline = get_rag_pipeline()
    pipeline.delete_course_material_vectors(course, storage_id)

    manifest = [e for e in manifest if e.get("storage_id") != storage_id]
    _save_manifest(course, manifest)
    return jsonify({"success": True}), 200
