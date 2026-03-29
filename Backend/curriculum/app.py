import json
import os
import traceback
from datetime import datetime
from io import BytesIO

import cv2
import fitz  # PyMuPDF
import numpy as np
import pytesseract
from PIL import Image
from flask import Flask, jsonify, request, send_file
from routes import curriculum_bp

# Configure Tesseract (native binary) - simple path detection
try:
    tesseract_paths = [
        os.getenv("TESSERACT_CMD", "").strip(),
        r"C:\Program Files\Tesseract-OCR\tesseract.exe",
        r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
        os.path.expandvars(r"%LOCALAPPDATA%\Programs\Tesseract-OCR\tesseract.exe"),
        r"C:\Users\bhank\AppData\Local\Programs\Tesseract-OCR\tesseract.exe",
    ]
    tesseract_cmd = None
    for path in tesseract_paths:
        if path and os.path.exists(path):
            tesseract_cmd = path
            pytesseract.pytesseract.tesseract_cmd = path
            break
    if tesseract_cmd:
        print(f"✅ Tesseract OCR configured: {tesseract_cmd}")
        try:
            version = pytesseract.get_tesseract_version()
            print(f"✅ Tesseract version: {version}")
        except:
            pass
    else:
        print("⚠️  Tesseract OCR not found. OCR features will not work.")
except Exception as e:
    print(f"⚠️  Tesseract configuration error: {e}")

app = Flask(__name__)

# Register blueprint
app.register_blueprint(curriculum_bp, url_prefix='/api')

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
app.config["UPLOAD_FOLDER"] = os.path.join(BASE_DIR, "uploads")
app.config["EMBEDDINGS_FILE"] = os.path.join(BASE_DIR, "file.txt")
app.config["CURRICULUM_UPLOAD_FOLDER"] = os.path.join(BASE_DIR, "curriculum_uploads")
app.config["CURRICULUM_EMBEDDINGS_FOLDER"] = os.path.join(BASE_DIR, "curriculum_embeddings")

os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)
os.makedirs(app.config["CURRICULUM_UPLOAD_FOLDER"], exist_ok=True)
os.makedirs(app.config["CURRICULUM_EMBEDDINGS_FOLDER"], exist_ok=True)


SUPPORTED_CURRICULUM = {
    "physics": "Physics",
    "chemistry": "Chemistry",
    "computer_science": "Computer Science",
}


# Initialize embedding model
embedding_tokenizer = None
embedding_model = None
embedding_model_error = None

try:
    print("🔄 Loading embedding model 'BAAI/bge-base-en-v1.5'...")
    print("   This may take a few minutes on first run (downloading model)...")
    from transformers import AutoTokenizer, AutoModel
    embedding_tokenizer = AutoTokenizer.from_pretrained("BAAI/bge-base-en-v1.5")
    embedding_model = AutoModel.from_pretrained("BAAI/bge-base-en-v1.5")
    print("✅ Embedding model loaded successfully")
except ImportError as exc:
    error_msg = f"Missing required package. Please install: pip install transformers"
    print(f"❌ {error_msg}")
    print(f"   Error details: {exc}")
    embedding_model_error = error_msg
except Exception as exc:
    error_msg = f"Failed to load embedding model: {str(exc)}"
    print(f"❌ {error_msg}")
    print(f"   Full error: {type(exc).__name__}: {exc}")
    traceback.print_exc()
    embedding_model_error = error_msg


def allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() == "pdf"


def pdf_to_images(pdf_path: str):
    try:
        images = []
        pdf_document = fitz.open(pdf_path)

        for page_num in range(len(pdf_document)):
            page = pdf_document.load_page(page_num)
            mat = fitz.Matrix(300 / 72, 300 / 72)
            pix = page.get_pixmap(matrix=mat)
            img_data = pix.tobytes("ppm")
            img = Image.open(BytesIO(img_data))
            open_cv_image = np.array(img)
            images.append(open_cv_image[:, :, ::-1].copy())

        pdf_document.close()
        return images
    except Exception as exc:
        print(f"❌ Error converting PDF to images: {exc}")
        traceback.print_exc()
        return None


def extract_text_direct(pdf_path: str):
    """Extract text directly from PDF using PyMuPDF (for text-based PDFs)"""
    try:
        print(f"📖 Attempting direct text extraction from PDF: {pdf_path}")
        pdf_document = fitz.open(pdf_path)
        all_text = ""
        
        for page_num in range(len(pdf_document)):
            page = pdf_document.load_page(page_num)
            page_text = page.get_text()
            if page_text.strip():
                all_text += f"\n--- Page {page_num + 1} ---\n{page_text}\n"
        
        pdf_document.close()
        
        if all_text.strip():
            print(f"✅ Direct extraction successful: {len(all_text.strip())} characters")
            return all_text.strip()
        else:
            print("⚠️ Direct extraction returned empty text, will try OCR")
            return None
    except Exception as exc:
        print(f"⚠️ Direct extraction failed: {exc}, will try OCR")
        return None


def extract_text_with_ocr(pdf_path: str):
    """Extract text from PDF using OCR (for scanned/image-based PDFs)"""
    try:
        print(f"🔍 Attempting OCR text extraction from PDF: {pdf_path}")
        
        # Check if Tesseract is available
        try:
            pytesseract.get_tesseract_version()
        except Exception:
            error_msg = "Tesseract OCR is not installed or not in PATH. Please install Tesseract OCR."
            print(f"❌ {error_msg}")
            raise Exception(error_msg)
        
        images = pdf_to_images(pdf_path)
        if not images:
            return None

        all_text = ""
        config = (
            r"--oem 3 --psm 6 "
            r"-c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,!?;:()[]{}@#$%^&*+-=<>/|_ "
        )

        for i, image in enumerate(images):
            print(f"📄 Processing page {i + 1}/{len(images)} with OCR")
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            denoised = cv2.medianBlur(gray, 3)
            _, processed_image = cv2.threshold(
                denoised, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU
            )
            page_text = pytesseract.image_to_string(processed_image, config=config)
            all_text += f"\n--- Page {i + 1} ---\n{page_text}\n"

        result = all_text.strip()
        if result:
            print(f"✅ OCR extraction successful: {len(result)} characters")
        return result
    except Exception as exc:
        print(f"❌ OCR extraction failed: {exc}")
        traceback.print_exc()
        return None


def extract_text_from_pdf(pdf_path: str):
    """Extract text from PDF - tries direct extraction first, falls back to OCR"""
    try:
        # First, try direct text extraction (faster, works for text-based PDFs)
        text = extract_text_direct(pdf_path)
        if text and len(text.strip()) > 50:  # Ensure we got meaningful text
            return text
        
        # If direct extraction failed or returned minimal text, try OCR
        print("🔄 Falling back to OCR extraction...")
        text = extract_text_with_ocr(pdf_path)
        if text and len(text.strip()) > 50:
            return text
        
        # If both methods failed
        error_details = []
        if not text:
            error_details.append("Both direct extraction and OCR returned empty text")
        else:
            error_details.append(f"Extracted text too short ({len(text)} characters)")
        
        print(f"❌ Text extraction failed: {'; '.join(error_details)}")
        return None
        
    except Exception as exc:
        print(f"❌ Error extracting text from PDF: {exc}")
        traceback.print_exc()
        return None


def generate_curriculum_embeddings(text: str, curriculum_name: str):
    try:
        if embedding_model is None or embedding_tokenizer is None:
            return None

        import torch

        paragraphs = [
            p.strip() for p in text.split("\n\n") if p.strip() and len(p.strip()) > 50
        ][:20]

        embeddings = {}
        for i, paragraph in enumerate(paragraphs):
            # Tokenize and encode
            inputs = embedding_tokenizer(paragraph, return_tensors="pt", padding=True, truncation=True, max_length=512)
            with torch.no_grad():
                outputs = embedding_model(**inputs)
                # Mean pooling
                embedding = outputs.last_hidden_state.mean(dim=1).squeeze().tolist()
            
            embeddings[f"paragraph_{i}"] = {
                "text": paragraph[:500] + "..." if len(paragraph) > 500 else paragraph,
                "embedding": embedding,
            }

        full_text_sample = text[:2000]
        inputs = embedding_tokenizer(full_text_sample, return_tensors="pt", padding=True, truncation=True, max_length=512)
        with torch.no_grad():
            outputs = embedding_model(**inputs)
            full_embedding = outputs.last_hidden_state.mean(dim=1).squeeze().tolist()
        
        embeddings["full_text_sample"] = {
            "text": full_text_sample,
            "embedding": full_embedding,
        }

        embeddings["metadata"] = {
            "curriculum_name": curriculum_name,
            "total_paragraphs": len(paragraphs),
            "total_characters": len(text),
            "embedding_count": len(embeddings) - 1,
            "created_at": datetime.now().isoformat(),
        }

        return embeddings
    except Exception as exc:
        print(f"❌ Error generating embeddings: {exc}")
        traceback.print_exc()
        return None


def save_embeddings_to_txt(record: dict):
    with open(app.config["EMBEDDINGS_FILE"], "a", encoding="utf-8") as file_handle:
        file_handle.write(json.dumps(record, ensure_ascii=False))
        file_handle.write("\n")


@app.route("/api/upload", methods=["POST"])
def upload_pdf():
    try:
        if embedding_model is None:
            error_msg = "Embedding model is unavailable. "
            if embedding_model_error:
                error_msg += f"Error: {embedding_model_error}. "
            error_msg += "Please check the server logs and ensure sentence-transformers is installed: pip install sentence-transformers"
            return jsonify({"error": error_msg}), 500

        # Debug: Check what files are being sent
        print(f"📋 Request files keys: {list(request.files.keys())}")
        print(f"📋 Request form keys: {list(request.form.keys())}")
        print(f"📋 Content-Type: {request.content_type}")
        print(f"📋 Request method: {request.method}")
        print(f"📋 Request headers: {dict(request.headers)}")

        # Try to find the PDF file - check common field names
        pdf_file = None
        if "pdf" in request.files:
            pdf_file = request.files["pdf"]
        elif "file" in request.files:
            pdf_file = request.files["file"]
        elif len(request.files) > 0:
            # If there's any file, use the first one
            pdf_file = list(request.files.values())[0]
        
        if not pdf_file or pdf_file.filename == "":
            available_keys = list(request.files.keys())
            return jsonify({
                "error": "No PDF file provided",
                "hint": f'Expected field name: "pdf", but received: {available_keys if available_keys else "no files"}',
                "content_type": request.content_type,
                "received_files": available_keys,
                "received_form_fields": list(request.form.keys()),
                "instructions": "Make sure to send the request as multipart/form-data with a field named 'pdf' containing a PDF file"
            }), 400
        if pdf_file.filename == "":
            return jsonify({"error": "Empty filename"}), 400

        if not allowed_file(pdf_file.filename):
            return jsonify({"error": "Only PDF files are allowed"}), 400

        curriculum_key = request.form.get("curriculum", "general").lower()
        curriculum_name = SUPPORTED_CURRICULUM.get(curriculum_key, "General Curriculum")

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        saved_filename = f"{curriculum_key}_{timestamp}_{pdf_file.filename}"
        saved_path = os.path.join(app.config["UPLOAD_FOLDER"], saved_filename)
        pdf_file.save(saved_path)

        extracted_text = extract_text_from_pdf(saved_path)
        if not extracted_text:
            error_message = (
                "Failed to extract text from the uploaded PDF. "
                "Possible reasons:\n"
                "1. PDF is encrypted or password-protected\n"
                "2. PDF contains only images (scanned PDF) and Tesseract OCR is not installed\n"
                "3. PDF is corrupted or empty\n"
                "4. Tesseract OCR not found in PATH (for scanned PDFs)\n\n"
                "Solution: Install Tesseract OCR from https://github.com/tesseract-ocr/tesseract"
            )
            return jsonify({"error": error_message}), 400

        embeddings = generate_curriculum_embeddings(extracted_text, curriculum_name)
        if not embeddings:
            return jsonify({"error": "Failed to generate embeddings"}), 500

        save_embeddings_to_txt(
            {
                "timestamp": datetime.now().isoformat(),
                "curriculum": curriculum_name,
                "filename": saved_filename,
                "metadata": embeddings.get("metadata"),
                "embeddings": embeddings,
            }
        )

        return jsonify(
            {
                "success": True,
                "message": "PDF processed and embeddings stored in file.txt",
                "filename": saved_filename,
                "embedding_count": embeddings["metadata"]["embedding_count"],
            }
        )
    except Exception as exc:
        print(f"❌ Upload error: {exc}")
        traceback.print_exc()
        return jsonify({"error": f"Server error: {exc}"}), 500


@app.route("/api/embeddings-file", methods=["GET"])
def download_embeddings_file():
    if not os.path.exists(app.config["EMBEDDINGS_FILE"]):
        return jsonify({"error": "No embeddings have been stored yet"}), 404

    return send_file(
        app.config["EMBEDDINGS_FILE"],
        as_attachment=True,
        download_name="file.txt",
        mimetype="text/plain",
    )


@app.route("/api/health", methods=["GET"])
def health_check():
    health_status = {
        "status": "healthy" if embedding_model is not None else "degraded",
        "service": "curriculum_embeddings",
        "supported_curriculum": SUPPORTED_CURRICULUM,
        "timestamp": datetime.now().isoformat(),
        "embedding_model": {
            "loaded": embedding_model is not None,
            "error": embedding_model_error if embedding_model_error else None,
        },
        "tesseract_ocr": {
            "configured": pytesseract.pytesseract.tesseract_cmd is not None,
            "tesseract_cmd": pytesseract.pytesseract.tesseract_cmd if pytesseract.pytesseract.tesseract_cmd else None,
            "tesseract_version": str(pytesseract.get_tesseract_version()) if pytesseract.pytesseract.tesseract_cmd else None,
        },
    }
    status_code = 200 if embedding_model is not None else 503
    return jsonify(health_status), status_code


@app.route("/api/routes", methods=["GET"])
def list_routes():
    """List all available API routes"""
    routes = []
    for rule in app.url_map.iter_rules():
        routes.append({
            "endpoint": rule.endpoint,
            "methods": list(rule.methods - {"OPTIONS", "HEAD"}),
            "path": str(rule)
        })
    return jsonify({"routes": routes}), 200


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)

