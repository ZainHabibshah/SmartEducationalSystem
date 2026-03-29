from flask import Blueprint, request, jsonify, send_file, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
import os
import cv2
import numpy as np
import pytesseract
from PIL import Image
import json
from datetime import datetime
import traceback
import fitz  # PyMuPDF for PDF processing
from io import BytesIO
from database import connect_to_mongodb

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

# Create Blueprint
curriculum_bp = Blueprint('curriculum', __name__)  # CHANGED

# Initialize the embedding model
embedding_tokenizer = None
embedding_model = None
try:
    from transformers import AutoTokenizer, AutoModel
    embedding_tokenizer = AutoTokenizer.from_pretrained("BAAI/bge-base-en-v1.5")
    embedding_model = AutoModel.from_pretrained("BAAI/bge-base-en-v1.5")
    print("✅ Curriculum: Embedding model loaded successfully")
except Exception as e:
    print(f"❌ Curriculum: Embedding model failed: {e}")
    embedding_tokenizer = None
    embedding_model = None

# Supported curriculum
SUPPORTED_CURRICULUM = {  # CHANGED
    'physics': 'Physics',
    'chemistry': 'Chemistry', 
    'computer_science': 'Computer Science'
}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in {'pdf'}

def pdf_to_images(pdf_path):
    """Convert PDF pages to images for OCR processing"""
    try:
        print(f"🔧 Converting PDF to images: {pdf_path}")
        images = []
        
        # Open the PDF
        pdf_document = fitz.open(pdf_path)
        
        for page_num in range(len(pdf_document)):
            # Get the page
            page = pdf_document.load_page(page_num)
            
            # Convert to image (300 DPI for good quality)
            mat = fitz.Matrix(300/72, 300/72)  # 300 DPI
            pix = page.get_pixmap(matrix=mat)
            
            # Convert to PIL Image
            img_data = pix.tobytes("ppm")
            img = Image.open(BytesIO(img_data))
            
            # Convert to OpenCV format
            open_cv_image = np.array(img)
            open_cv_image = open_cv_image[:, :, ::-1].copy()  # Convert RGB to BGR
            
            images.append(open_cv_image)
        
        pdf_document.close()
        print(f"✅ Converted {len(images)} pages to images")
        return images
        
    except Exception as e:
        print(f"❌ Error converting PDF to images: {str(e)}")
        return None

def extract_text_direct(pdf_path):
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
    except Exception as e:
        print(f"⚠️ Direct extraction failed: {e}, will try OCR")
        return None

def extract_text_with_ocr(pdf_path):
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
    except Exception as e:
        print(f"❌ OCR extraction failed: {e}")
        traceback.print_exc()
        return None

def extract_text_from_pdf(pdf_path):
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
        
    except Exception as e:
        print(f"❌ Error extracting text from PDF: {e}")
        traceback.print_exc()
        return None

def generate_curriculum_embeddings(text, curriculum_name):  # CHANGED
    """Generate embeddings for curriculum content"""
    try:
        if embedding_model is None or embedding_tokenizer is None:
            print("❌ Embedding model not available")
            return None
        
        import torch
            
        print(f"🧮 Generating embeddings for {curriculum_name}")
        
        # Split text into chunks (to handle large PDFs)
        paragraphs = [p.strip() for p in text.split('\n\n') if p.strip() and len(p.strip()) > 50]
        
        # If too many paragraphs, take first 20 (adjust as needed)
        if len(paragraphs) > 20:
            paragraphs = paragraphs[:20]
            print(f"📝 Using first 20 paragraphs out of {len(paragraphs)}")
        
        # Generate embeddings for each paragraph
        embeddings = {}
        for i, paragraph in enumerate(paragraphs):
            if len(paragraph) > 50:  # Only embed meaningful paragraphs
                # Tokenize and encode
                inputs = embedding_tokenizer(paragraph, return_tensors="pt", padding=True, truncation=True, max_length=512)
                with torch.no_grad():
                    outputs = embedding_model(**inputs)
                    # Mean pooling
                    embedding = outputs.last_hidden_state.mean(dim=1).squeeze().tolist()
                
                embeddings[f"paragraph_{i}"] = {
                    "text": paragraph[:500] + "..." if len(paragraph) > 500 else paragraph,  # Truncate for storage
                    "embedding": embedding
                }
        
        # Generate embedding for entire text (first 2000 chars)
        full_text_sample = text[:2000]
        inputs = embedding_tokenizer(full_text_sample, return_tensors="pt", padding=True, truncation=True, max_length=512)
        with torch.no_grad():
            outputs = embedding_model(**inputs)
            full_embedding = outputs.last_hidden_state.mean(dim=1).squeeze().tolist()
        
        embeddings["full_text_sample"] = {
            "text": full_text_sample,
            "embedding": full_embedding
        }
        
        # Add curriculum metadata
        embeddings["metadata"] = {
            "curriculum_name": curriculum_name,  # CHANGED
            "total_paragraphs": len(paragraphs),
            "total_characters": len(text),
            "embedding_count": len(embeddings) - 1,  # Exclude metadata
            "created_at": datetime.now().isoformat()
        }
        
        print(f"✅ Generated {len(embeddings)} embeddings for {curriculum_name}")
        return embeddings
    
    except Exception as e:
        print(f"❌ Error generating curriculum embeddings: {str(e)}")
        traceback.print_exc()
        return None

def save_curriculum_embeddings(embeddings, curriculum_name, embeddings_folder):  # CHANGED
    """Save curriculum embeddings to JSON file"""
    try:
        filename = f"{curriculum_name}_{datetime.now().strftime('%Y%m%d_%H%M%S')}_embeddings.json"
        filepath = os.path.join(embeddings_folder, filename)
        
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(embeddings, f, indent=2, ensure_ascii=False)
        
        print(f"💾 Saved curriculum embeddings to: {filepath}")
        return filename
        
    except Exception as e:
        print(f"❌ Error saving curriculum embeddings: {str(e)}")
        return None

def get_curriculum_files(curriculum_name):  # CHANGED
    """Get all files for a specific curriculum"""
    try:
        upload_folder = os.path.join(current_app.config['CURRICULUM_UPLOAD_FOLDER'], curriculum_name)  # CHANGED
        embeddings_folder = os.path.join(current_app.config['CURRICULUM_EMBEDDINGS_FOLDER'], curriculum_name)  # CHANGED
        
        pdf_files = []
        embedding_files = []
        
        # Get PDF files
        if os.path.exists(upload_folder):
            for file in os.listdir(upload_folder):
                if file.endswith('.pdf'):
                    filepath = os.path.join(upload_folder, file)
                    file_stats = os.stat(filepath)
                    pdf_files.append({
                        'filename': file,
                        'upload_date': datetime.fromtimestamp(file_stats.st_mtime).strftime('%Y-%m-%d %H:%M:%S'),
                        'size': file_stats.st_size,
                        'curriculum': curriculum_name  # CHANGED
                    })
        
        # Get embedding files
        if os.path.exists(embeddings_folder):
            for file in os.listdir(embeddings_folder):
                if file.endswith('.json'):
                    filepath = os.path.join(embeddings_folder, file)
                    file_stats = os.stat(filepath)
                    embedding_files.append({
                        'filename': file,
                        'created_date': datetime.fromtimestamp(file_stats.st_mtime).strftime('%Y-%m-%d %H:%M:%S'),
                        'size': file_stats.st_size,
                        'curriculum': curriculum_name  # CHANGED
                    })
        
        return pdf_files, embedding_files
        
    except Exception as e:
        print(f"❌ Error getting curriculum files: {str(e)}")
        return [], []

def verify_operation_otp(operation_type):
    """Helper function to verify OTP for operations"""
    try:
        current_user = get_jwt_identity()
        if current_user['role'] != 'admin':
            return False, "Only admin can perform this operation"
        
        # Try to get OTP from JSON first, then from form data (for file uploads)
        otp = None
        if request.is_json:
            data = request.get_json()
            otp = data.get('otp')
        else:
            otp = request.form.get('otp')
        
        if not otp:
            return False, "OTP is required for this operation. Please request an OTP first."
        
        db = connect_to_mongodb()
        if db is None:
            return False, "Database connection failed"
        
        admin_collection = db.admin
        admin = admin_collection.find_one({"email": current_user['email']})
        
        if not admin:
            return False, "Admin not found"
        
        stored_otp = admin.get("operation_otp")
        expires_at = admin.get("operation_otp_expires_at")
        stored_operation_type = admin.get("operation_otp_type")
        
        if not stored_otp or not expires_at:
            return False, "No OTP found. Please request a new OTP."
        
        if stored_operation_type != operation_type:
            return False, "OTP was generated for a different operation. Please request a new OTP."
        
        if datetime.utcnow() > expires_at:
            return False, "OTP has expired. Please request a new OTP."
        
        if str(otp) != str(stored_otp):
            return False, "Invalid OTP"
        
        # Clear OTP after verification
        admin_collection.update_one(
            {"_id": admin["_id"]},
            {"$unset": {"operation_otp": "", "operation_otp_expires_at": "", "operation_otp_type": ""}},
        )
        
        return True, "OTP verified"
    except Exception as e:
        return False, f"Error verifying OTP: {str(e)}"

@curriculum_bp.route('/upload-curriculum-pdf', methods=['POST'])  # CHANGED
@jwt_required()
def upload_curriculum_pdf():  # CHANGED
    """Upload PDF for a specific curriculum and generate embeddings"""
    try:
        # Verify OTP for upload operation
        verified, message = verify_operation_otp('upload_curriculum')
        if not verified:
            return jsonify({"error": message}), 400
        
        # Debug: Check what files are being sent
        print(f"📋 Request files keys: {list(request.files.keys())}")
        print(f"📋 Request form keys: {list(request.form.keys())}")
        print(f"📋 Content-Type: {request.content_type}")
        
        # Get curriculum from form data
        curriculum = request.form.get('curriculum')  # CHANGED
        if not curriculum or curriculum not in SUPPORTED_CURRICULUM:  # CHANGED
            return jsonify({
                'error': f'Invalid curriculum. Supported curriculum: {", ".join(SUPPORTED_CURRICULUM.keys())}'  # CHANGED
            }), 400
        
        if 'pdf' not in request.files:
            available_keys = list(request.files.keys())
            return jsonify({
                'error': 'No PDF file provided',
                'hint': f'Expected field name: "pdf", but received: {available_keys if available_keys else "no files"}',
                'content_type': request.content_type,
                'instructions': 'Make sure to send the request as multipart/form-data with a field named "pdf"'
            }), 400
        
        file = request.files['pdf']
        
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        if file and allowed_file(file.filename):
            # Create curriculum-specific folders
            curriculum_upload_folder = os.path.join(current_app.config['CURRICULUM_UPLOAD_FOLDER'], curriculum)  # CHANGED
            curriculum_embeddings_folder = os.path.join(current_app.config['CURRICULUM_EMBEDDINGS_FOLDER'], curriculum)  # CHANGED
            os.makedirs(curriculum_upload_folder, exist_ok=True)
            os.makedirs(curriculum_embeddings_folder, exist_ok=True)
            
            # Save uploaded file
            filename = f"{curriculum}_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{file.filename}"
            filepath = os.path.join(curriculum_upload_folder, filename)
            file.save(filepath)
            
            print(f"📁 Curriculum PDF saved: {filepath}")
            print(f"📊 File size: {os.path.getsize(filepath)} bytes")
            print(f"🎯 Curriculum: {SUPPORTED_CURRICULUM[curriculum]}")  # CHANGED
            
            # Extract text from PDF
            extracted_text = extract_text_from_pdf(filepath)
            
            if not extracted_text:
                return jsonify({
                    'error': 'Could not extract text from PDF. Possible reasons:\n1. PDF is scanned image (not searchable)\n2. Poor quality scan\n3. PDF is encrypted or protected'
                }), 400
            
            # Generate embeddings
            embeddings = generate_curriculum_embeddings(extracted_text, SUPPORTED_CURRICULUM[curriculum])  # CHANGED
            
            if not embeddings:
                return jsonify({'error': 'Could not generate embeddings from PDF content'}), 400
            
            # Save embeddings to JSON file
            embeddings_filename = save_curriculum_embeddings(  # CHANGED
                embeddings, 
                curriculum, 
                curriculum_embeddings_folder
            )
            
            if not embeddings_filename:
                return jsonify({'error': 'Could not save embeddings'}), 400
            
            return jsonify({
                'success': True,
                'message': f'{SUPPORTED_CURRICULUM[curriculum]} PDF processed successfully',  # CHANGED
                'curriculum': curriculum,  # CHANGED
                'curriculum_name': SUPPORTED_CURRICULUM[curriculum],  # CHANGED
                'filename': filename,
                'embeddings_file': embeddings_filename,
                'extracted_text_length': len(extracted_text),
                'embedding_count': embeddings["metadata"]["embedding_count"]
            }), 200
        
        else:
            return jsonify({'error': 'Invalid file type. Only PDF files are allowed'}), 400
    
    except Exception as e:
        print(f"❌ Upload curriculum PDF error: {str(e)}")
        traceback.print_exc()
        return jsonify({'error': f'Server error: {str(e)}'}), 500

@curriculum_bp.route('/download-curriculum-pdf/<curriculum>/<filename>', methods=['GET'])  # CHANGED
def download_curriculum_pdf(curriculum, filename):  # CHANGED
    """Download curriculum PDF file"""
    try:
        if curriculum not in SUPPORTED_CURRICULUM:  # CHANGED
            return jsonify({'error': 'Invalid curriculum'}), 400  # CHANGED
        
        filepath = os.path.join(current_app.config['CURRICULUM_UPLOAD_FOLDER'], curriculum, filename)  # CHANGED
        
        if not os.path.exists(filepath):
            return jsonify({'error': 'PDF file not found'}), 404
        
        return send_file(
            filepath,
            as_attachment=True,
            download_name=filename,
            mimetype='application/pdf'
        )
    
    except Exception as e:
        print(f"❌ Download curriculum PDF error: {str(e)}")
        return jsonify({'error': f'Server error: {str(e)}'}), 500

@curriculum_bp.route('/list-curriculum', methods=['GET'])  # CHANGED
def list_curriculum():  # CHANGED
    """Get list of all curriculum with their files"""
    try:
        curriculum_data = {}  # CHANGED
        
        for curriculum_key, curriculum_name in SUPPORTED_CURRICULUM.items():  # CHANGED
            pdf_files, embedding_files = get_curriculum_files(curriculum_key)  # CHANGED
            
            curriculum_data[curriculum_key] = {  # CHANGED
                'curriculum_name': curriculum_name,  # CHANGED
                'pdf_files': pdf_files,
                'embedding_files': embedding_files,
                'pdf_count': len(pdf_files),
                'embedding_count': len(embedding_files)
            }
        
        return jsonify({
            'success': True,
            'curriculum': curriculum_data,  # CHANGED
            'total_curriculum': len(SUPPORTED_CURRICULUM)  # CHANGED
        }), 200
    
    except Exception as e:
        print(f"❌ List curriculum error: {str(e)}")
        return jsonify({'error': f'Server error: {str(e)}'}), 500

@curriculum_bp.route('/get-curriculum-embeddings/<curriculum>/<embeddings_filename>', methods=['GET'])  # CHANGED
def get_curriculum_embeddings(curriculum, embeddings_filename):  # CHANGED
    """Get embeddings for a specific curriculum"""
    try:
        if curriculum not in SUPPORTED_CURRICULUM:  # CHANGED
            return jsonify({'error': 'Invalid curriculum'}), 400  # CHANGED
        
        embeddings_path = os.path.join(current_app.config['CURRICULUM_EMBEDDINGS_FOLDER'], curriculum, embeddings_filename)  # CHANGED
        
        if not os.path.exists(embeddings_path):
            return jsonify({'error': 'Embeddings file not found'}), 404
        
        with open(embeddings_path, 'r', encoding='utf-8') as f:
            embeddings_data = json.load(f)
        
        return jsonify({
            'success': True,
            'curriculum': curriculum,  # CHANGED
            'curriculum_name': SUPPORTED_CURRICULUM[curriculum],  # CHANGED
            'filename': embeddings_filename,
            'embeddings': embeddings_data
        }), 200
    
    except Exception as e:
        print(f"❌ Get curriculum embeddings error: {str(e)}")
        return jsonify({'error': f'Server error: {str(e)}'}), 500

@curriculum_bp.route('/delete-curriculum-pdf/<curriculum>/<filename>', methods=['DELETE'])  # CHANGED
@jwt_required()
def delete_curriculum_pdf(curriculum, filename):  # CHANGED
    """Delete curriculum PDF and its embeddings"""
    try:
        # Verify OTP for delete operation
        data = request.get_json() if request.is_json else {}
        otp = data.get('otp')
        
        verified, message = verify_operation_otp('delete_curriculum')
        if not verified:
            return jsonify({"error": message}), 400
        
        if curriculum not in SUPPORTED_CURRICULUM:  # CHANGED
            return jsonify({'error': 'Invalid curriculum'}), 400  # CHANGED
        
        # Delete PDF file
        pdf_path = os.path.join(current_app.config['CURRICULUM_UPLOAD_FOLDER'], curriculum, filename)  # CHANGED
        
        # Find and delete corresponding embeddings file
        embeddings_folder = os.path.join(current_app.config['CURRICULUM_EMBEDDINGS_FOLDER'], curriculum)  # CHANGED
        embeddings_filename = None
        
        if os.path.exists(embeddings_folder):
            for file in os.listdir(embeddings_folder):
                if filename.split('_')[1] in file:  # Match by timestamp
                    embeddings_filename = file
                    break
        
        deleted_files = []
        
        if os.path.exists(pdf_path):
            os.remove(pdf_path)
            deleted_files.append('pdf')
            print(f"🗑️ Deleted PDF: {pdf_path}")
        
        if embeddings_filename:
            embeddings_path = os.path.join(embeddings_folder, embeddings_filename)
            if os.path.exists(embeddings_path):
                os.remove(embeddings_path)
                deleted_files.append('embeddings')
                print(f"🗑️ Deleted embeddings: {embeddings_path}")
        
        if deleted_files:
            return jsonify({
                'success': True,
                'message': f'{SUPPORTED_CURRICULUM[curriculum]} files deleted successfully',  # CHANGED
                'deleted_files': deleted_files,
                'curriculum': curriculum,  # CHANGED
                'filename': filename
            }), 200
        else:
            return jsonify({'error': 'No files found to delete'}), 404
    
    except Exception as e:
        print(f"❌ Delete curriculum PDF error: {str(e)}")
        return jsonify({'error': f'Server error: {str(e)}'}), 500

@curriculum_bp.route('/curriculum-health', methods=['GET'])  # CHANGED
def curriculum_health_check():  # CHANGED
    """Health check endpoint for curriculum service"""
    return jsonify({
        'status': 'healthy', 
        'service': 'curriculum',  # CHANGED
        'supported_curriculum': SUPPORTED_CURRICULUM,  # CHANGED
        'tesseract': {
            'configured': pytesseract.pytesseract.tesseract_cmd is not None,
            'tesseract_cmd': pytesseract.pytesseract.tesseract_cmd if pytesseract.pytesseract.tesseract_cmd else None,
            'tesseract_version': str(pytesseract.get_tesseract_version()) if pytesseract.pytesseract.tesseract_cmd else None,
        },
        'timestamp': datetime.now().isoformat()
    }), 200