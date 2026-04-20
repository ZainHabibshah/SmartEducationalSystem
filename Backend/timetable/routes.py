from flask import Blueprint, request, jsonify, send_file, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
import os
import cv2
import numpy as np
import pytesseract
from PIL import Image
import json
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from datetime import datetime
import traceback
from database import connect_to_mongodb
# Create Blueprint
timetable_bp = Blueprint('timetable', __name__)

# Configure Tesseract (native binary) - simple path detection
try:
    import os
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

# Initialize the embedding model (optional - timetable will work without it)
embedding_tokenizer = None
embedding_model = None
try:
    from transformers import AutoTokenizer, AutoModel
    embedding_tokenizer = AutoTokenizer.from_pretrained("BAAI/bge-base-en-v1.5")
    embedding_model = AutoModel.from_pretrained("BAAI/bge-base-en-v1.5")
    print("✅ Embedding model loaded successfully")
except ImportError as e:
    print(f"⚠️  Embedding model not available (missing dependency): {e}")
    print("⚠️  Timetable will work but without embeddings feature")
except Exception as e:
    print(f"⚠️  Embedding model failed to load: {e}")
    print("⚠️  Timetable will work but without embeddings feature")
    embedding_tokenizer = None
    embedding_model = None


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in {'png', 'jpg', 'jpeg'}

def preprocess_image(image_path):
    """Enhanced image preprocessing for better OCR"""
    try:
        print(f"🔧 Preprocessing image: {image_path}")
        
        # Read the image
        img = cv2.imread(image_path)
        if img is None:
            print("❌ Failed to read image")
            return None
        
        print(f"📐 Original image shape: {img.shape}")
        
        # Convert to grayscale
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        
        # Apply different preprocessing techniques
        
        # 1. Noise removal
        denoised = cv2.medianBlur(gray, 3)
        
        # 2. Try different thresholding methods
        # Simple threshold
        _, thresh_simple = cv2.threshold(denoised, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        
        # Adaptive threshold
        thresh_adaptive = cv2.adaptiveThreshold(denoised, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
                                               cv2.THRESH_BINARY, 11, 2)
        
        # 3. Try morphological operations to clean up image
        kernel = np.ones((1,1), np.uint8)
        opening = cv2.morphologyEx(thresh_simple, cv2.MORPH_OPEN, kernel)
        
        print("✅ Image preprocessing completed")
        return opening  # Return the cleaned image
        
    except Exception as e:
        print(f"❌ Error in image preprocessing: {str(e)}")
        traceback.print_exc()
        return None

def extract_text_from_image(image_path):
    """Enhanced text extraction with multiple OCR attempts"""
    try:
        print(f"🔍 Starting text extraction from: {image_path}")

        # Fail fast with a clear log if the native engine is missing
        try:
            pytesseract.get_tesseract_version()
        except Exception as e:
            print(f"❌ Tesseract OCR is not available: {e}")
            print("❌ Install Tesseract OCR and/or set TESSERACT_CMD to tesseract.exe")
            return None
        
        # Preprocess image
        processed_image = preprocess_image(image_path)
        
        if processed_image is None:
            print("❌ Image preprocessing failed")
            return None
        
        # Try different OCR configurations
        configs = [
            r'--oem 3 --psm 6',      # Uniform block of text
            r'--oem 3 --psm 3',      # Fully automatic page segmentation
            r'--oem 3 --psm 4',      # Assume a single column of text
            r'--oem 3 --psm 8',      # Single word
            r'--oem 3 --psm 11',     # Sparse text
        ]
        
        best_text = ""
        best_config = ""
        
        for config in configs:
            try:
                print(f"🔄 Trying OCR config: {config}")
                text = pytesseract.image_to_string(processed_image, config=config)
                
                # Count non-empty lines
                lines = [line.strip() for line in text.split('\n') if line.strip()]
                
                print(f"📝 Config {config} found {len(lines)} lines")
                
                if len(lines) > len(best_text.split('\n')):
                    best_text = text
                    best_config = config
                    
            except Exception as e:
                print(f"⚠️ OCR config {config} failed: {e}")
                continue
        
        if best_text:
            print(f"✅ Best OCR config: {best_config}")
            print(f"📄 Extracted {len(best_text.strip())} characters")
            return best_text.strip()
        else:
            print("❌ All OCR configurations failed")
            return None
        
    except Exception as e:
        print(f"❌ Error in text extraction: {str(e)}")
        traceback.print_exc()
        return None

def generate_embeddings(text):
    """Generate embeddings from text"""
    try:
        if embedding_model is None or embedding_tokenizer is None:
            print("❌ Embedding model not available")
            return None
        
        import torch
            
        # Split text into lines or chunks if needed
        lines = [line.strip() for line in text.split('\n') if line.strip()]
        
        print(f"🧮 Generating embeddings for {len(lines)} lines")
        
        # Generate embeddings for each line
        embeddings = {}
        for i, line in enumerate(lines):
            # Tokenize and encode
            inputs = embedding_tokenizer(line, return_tensors="pt", padding=True, truncation=True, max_length=512)
            with torch.no_grad():
                outputs = embedding_model(**inputs)
                # Mean pooling
                embedding = outputs.last_hidden_state.mean(dim=1).squeeze().tolist()
            
            embeddings[f"line_{i}"] = {
                "text": line,
                "embedding": embedding
            }
        
        # Also generate embedding for entire text
        inputs = embedding_tokenizer(text, return_tensors="pt", padding=True, truncation=True, max_length=512)
        with torch.no_grad():
            outputs = embedding_model(**inputs)
            full_embedding = outputs.last_hidden_state.mean(dim=1).squeeze().tolist()
        
        embeddings["full_text"] = {
            "text": text,
            "embedding": full_embedding
        }
        
        print(f"✅ Generated {len(embeddings)} embeddings")
        return embeddings
    
    except Exception as e:
        print(f"❌ Error generating embeddings: {str(e)}")
        traceback.print_exc()
        return None

def save_embeddings_to_txt(embeddings, filename, embeddings_folder):
    """Save embeddings to text file"""
    try:
        filepath = os.path.join(embeddings_folder, filename)
        
        with open(filepath, 'w', encoding='utf-8') as f:
            for key, value in embeddings.items():
                f.write(f"=== {key} ===\n")
                f.write(f"Text: {value['text']}\n")
                f.write(f"Embedding: {json.dumps(value['embedding'])}\n")
                f.write("\n")
        
        print(f"💾 Saved embeddings to: {filepath}")
        return filepath
    
    except Exception as e:
        print(f"❌ Error saving embeddings: {str(e)}")
        return None

def image_to_pdf(image_path, pdf_path):
    """Convert image to PDF"""
    try:
        # Create PDF
        c = canvas.Canvas(pdf_path, pagesize=letter)
        
        # Get image dimensions
        img = Image.open(image_path)
        img_width, img_height = img.size
        
        # Calculate scaling to fit page
        page_width, page_height = letter
        scale = min(page_width/img_width, page_height/img_height) * 0.9
        
        # Calculate position to center image
        x = (page_width - (img_width * scale)) / 2
        y = (page_height - (img_height * scale)) / 2
        
        # Draw image on PDF
        c.drawImage(image_path, x, y, width=img_width*scale, height=img_height*scale)
        c.save()
        
        print(f"✅ PDF created: {pdf_path}")
        return True
    
    except Exception as e:
        print(f"❌ Error converting to PDF: {str(e)}")
        return False

def delete_timetable_files(filename):
    """Delete all files associated with a timetable (image, PDF, embeddings)"""
    try:
        upload_folder = current_app.config['UPLOAD_FOLDER']
        embeddings_folder = current_app.config['EMBEDDINGS_FOLDER']
        
        deleted_files = []
        
        # 1. Delete original image file
        image_path = os.path.join(upload_folder, filename)
        if os.path.exists(image_path):
            os.remove(image_path)
            deleted_files.append('image')
            print(f"🗑️ Deleted image: {image_path}")
        
        # 2. Delete PDF file (if exists)
        pdf_filename = filename.rsplit('.', 1)[0] + '.pdf'
        pdf_path = os.path.join(upload_folder, pdf_filename)
        if os.path.exists(pdf_path):
            os.remove(pdf_path)
            deleted_files.append('pdf')
            print(f"🗑️ Deleted PDF: {pdf_path}")
        
        # 3. Delete embeddings file (if exists)
        embeddings_filename = filename.replace('.', '_') + '_embeddings.txt'
        embeddings_path = os.path.join(embeddings_folder, embeddings_filename)
        if os.path.exists(embeddings_path):
            os.remove(embeddings_path)
            deleted_files.append('embeddings')
            print(f"🗑️ Deleted embeddings: {embeddings_path}")
        
        # 4. Delete processed image (if exists) - from debugging
        processed_image_path = image_path.replace('.', '_processed.')
        if os.path.exists(processed_image_path):
            os.remove(processed_image_path)
            deleted_files.append('processed_image')
            print(f"🗑️ Deleted processed image: {processed_image_path}")
        
        return deleted_files
        
    except Exception as e:
        print(f"❌ Error deleting files: {str(e)}")
        raise e

def verify_operation_otp(operation_type):
    """Helper function to verify OTP for operations"""
    try:
        current_user = get_jwt_identity()
        if current_user['role'] != 'admin':
            return False, "Only admin can perform this operation"
        
        # Try to get OTP from multiple sources (JSON body, form data, or query params)
        otp = None
        
        # Try JSON body first (works for POST, PUT, DELETE with JSON)
        data = request.get_json(silent=True) or {}
        otp = data.get('otp')
        
        # Fallback to form data (for multipart/form-data uploads)
        if not otp:
            otp = request.form.get('otp')
        
        # Fallback to query parameters (as last resort)
        if not otp:
            otp = request.args.get('otp')
        
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

@timetable_bp.route('/upload-timetable', methods=['POST'])
@jwt_required()
def upload_timetable():
    """Enhanced upload endpoint with better error reporting"""
    try:
        # Verify OTP for upload operation
        verified, message = verify_operation_otp('upload_timetable')
        if not verified:
            return jsonify({"error": message}), 400
        
        # Add debug print to verify request is received
        print("📨 Received upload request")
        print(f"📦 Request files: {request.files}")
        
        if 'image' not in request.files:
            return jsonify({'error': 'No image file provided'}), 400
        
        file = request.files['image']
        
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        # Add debug print for file info
        print(f"📄 File received: {file.filename}")
        print(f"🔍 File content type: {file.content_type}")
        
        if file and allowed_file(file.filename):
            # Save uploaded file
            filename = f"timetable_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{file.filename}"
            filepath = os.path.join(current_app.config['UPLOAD_FOLDER'], filename)
            file.save(filepath)
            
            print(f"📁 File saved: {filepath}")
            print(f"📊 File size: {os.path.getsize(filepath)} bytes")
            
            # Optional: extract text for diagnostics only (no embeddings/vectors for timetable chatbot)
            extracted_text = None
            
            try:
                # Extract text from image (optional)
                extracted_text = extract_text_from_image(filepath)
                
                if extracted_text:
                    print(f"✅ Extracted {len(extracted_text)} characters of text")
                else:
                    print("⚠️  Could not extract text from image (OCR failed or Tesseract not installed)")
            except Exception as e:
                print(f"⚠️  OCR processing failed (non-critical): {e}")
                # Continue anyway - timetable image is saved and can be viewed
            
            return jsonify({
                'success': True,
                'message': 'Timetable uploaded successfully',
                'filename': filename,
                'extracted_text': extracted_text if extracted_text else 'OCR not available'
            }), 200
        
        else:
            return jsonify({'error': 'Invalid file type. Allowed: png, jpg, jpeg'}), 400
    
    except Exception as e:
        print(f"❌ Upload error: {str(e)}")
        traceback.print_exc()
        return jsonify({'error': f'Server error: {str(e)}'}), 500

@timetable_bp.route('/view-timetable/<filename>', methods=['GET'])
def view_timetable(filename):
    """View timetable image directly (for display in student app)"""
    try:
        filepath = os.path.join(current_app.config['UPLOAD_FOLDER'], filename)
        
        if not os.path.exists(filepath):
            return jsonify({'error': f'File not found: {filename}'}), 404
        
        # Determine MIME type based on file extension
        ext = filename.rsplit('.', 1)[-1].lower()
        mimetype_map = {
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
        }
        mimetype = mimetype_map.get(ext, 'image/jpeg')
        
        return send_file(
            filepath,
            mimetype=mimetype
        )
    
    except Exception as e:
        print(f"❌ View timetable error: {str(e)}")
        return jsonify({'error': f'Server error: {str(e)}'}), 500

@timetable_bp.route('/download-timetable/<filename>', methods=['GET'])
def download_timetable(filename):
    """Download timetable as image (not PDF)"""
    try:
        print(f"🔍 Looking for file: {filename}")
        
        # Check if file exists
        filepath = os.path.join(current_app.config['UPLOAD_FOLDER'], filename)
        print(f"📁 Checking path: {filepath}")
        
        if not os.path.exists(filepath):
            upload_folder = current_app.config['UPLOAD_FOLDER']
            all_files = os.listdir(upload_folder) if os.path.exists(upload_folder) else []
            print(f"📂 All files in upload folder: {all_files}")
            
            return jsonify({
                'error': f'File not found: {filename}',
                'searched_path': filepath,
                'available_files': all_files,
            }), 404
        
        print(f"✅ File found: {filepath}")
        
        # Determine MIME type based on file extension
        ext = filename.rsplit('.', 1)[-1].lower()
        mimetype_map = {
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
        }
        mimetype = mimetype_map.get(ext, 'image/jpeg')
        
        # Send image file directly (not PDF)
        return send_file(
            filepath,
            as_attachment=True,
            download_name=filename,
            mimetype=mimetype
        )
    
    except Exception as e:
        print(f"❌ Download error: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': f'Server error: {str(e)}'}), 500

@timetable_bp.route('/list-timetables', methods=['GET'])
# Remove @jwt_required()
def list_timetables():
    """Enhanced list endpoint with file existence checks"""
    try:
        timetables = []
        upload_folder = current_app.config['UPLOAD_FOLDER']
        
        if not os.path.exists(upload_folder):
            return jsonify({'error': 'Upload folder does not exist'}), 500
        
        all_files = os.listdir(upload_folder)
        print(f"📂 All files in uploads: {all_files}")
        
        for filename in all_files:
            if allowed_file(filename):
                filepath = os.path.join(upload_folder, filename)
                file_stats = os.stat(filepath)
                
                # Check if PDF version exists
                pdf_filename = filename.rsplit('.', 1)[0] + '.pdf'
                pdf_path = os.path.join(upload_folder, pdf_filename)
                has_pdf = os.path.exists(pdf_path)
                
                # Check if original file exists
                file_exists = os.path.exists(filepath)
                
                timetables.append({
                    'filename': filename,
                    'pdf_filename': pdf_filename if has_pdf else None,
                    'upload_date': datetime.fromtimestamp(file_stats.st_mtime).strftime('%Y-%m-%d %H:%M:%S'),
                    'size': file_stats.st_size,
                    'has_pdf': has_pdf,
                    'file_exists': file_exists,
                    'pdf_exists': has_pdf
                })
        
        return jsonify({
            'success': True,
            'timetables': timetables,
            'count': len(timetables),
            'upload_folder': upload_folder,
            'upload_folder_exists': os.path.exists(upload_folder)
        }), 200
    
    except Exception as e:
        return jsonify({'error': f'Server error: {str(e)}'}), 500

@timetable_bp.route('/delete-timetable/<filename>', methods=['DELETE'])
@jwt_required()
def delete_timetable(filename):
    """Delete a timetable and all associated files (image, PDF, embeddings)"""
    try:
        # Verify OTP for delete operation
        # For DELETE requests, data might be in request.json or request.data
        data = request.get_json(silent=True) or {}
        otp = data.get('otp')
        
        print(f"🗑️ Delete request for: {filename}")
        print(f"🔐 Received OTP: {otp}")
        
        verified, message = verify_operation_otp('delete_timetable')
        if not verified:
            print(f"❌ OTP verification failed: {message}")
            return jsonify({"error": message}), 400
        
        print(f"✅ OTP verified for delete operation")
        
        # Check if file exists before attempting deletion
        filepath = os.path.join(current_app.config['UPLOAD_FOLDER'], filename)
        if not os.path.exists(filepath):
            return jsonify({
                'error': f'Timetable not found: {filename}',
                'available_files': os.listdir(current_app.config['UPLOAD_FOLDER'])
            }), 404
        
        # Delete all associated files
        deleted_files = delete_timetable_files(filename)
        # Clear timetable chatbot cached context so deleted file is not used
        try:
            from chatbot.routes import get_rag_pipeline
            pipeline = get_rag_pipeline()
            if pipeline:
                pipeline.clear_timetable_context_cache()
        except Exception as vec_err:
            print(f"⚠️  Could not clear timetable chatbot cache for {filename}: {vec_err}")
        
        if deleted_files:
            return jsonify({
                'success': True,
                'message': f'Timetable deleted successfully',
                'deleted_files': deleted_files,
                'filename': filename
            }), 200
        else:
            return jsonify({
                'error': 'No files were deleted',
                'filename': filename
            }), 400
            
    except Exception as e:
        print(f"❌ Delete error: {str(e)}")
        traceback.print_exc()
        return jsonify({'error': f'Server error: {str(e)}'}), 500

@timetable_bp.route('/debug-files', methods=['GET'])
# Remove @jwt_required()
def debug_files():
    """Debug endpoint to see what files actually exist"""
    try:
        upload_folder = current_app.config['UPLOAD_FOLDER']
        embeddings_folder = current_app.config['EMBEDDINGS_FOLDER']
        
        upload_files = os.listdir(upload_folder) if os.path.exists(upload_folder) else []
        embedding_files = os.listdir(embeddings_folder) if os.path.exists(embeddings_folder) else []
        
        return jsonify({
            'upload_folder': upload_folder,
            'upload_files': upload_files,
            'embeddings_folder': embeddings_folder,
            'embedding_files': embedding_files,
            'absolute_paths': {
                'uploads': os.path.abspath(upload_folder),
                'embeddings': os.path.abspath(embeddings_folder)
            }
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Debug error: {str(e)}'}), 500

@timetable_bp.route('/health', methods=['GET'])
def timetable_health_check():
    """Health check endpoint for timetable service"""
    tesseract_configured = pytesseract.pytesseract.tesseract_cmd is not None
    tesseract_version = None
    try:
        if tesseract_configured:
            tesseract_version = str(pytesseract.get_tesseract_version())
    except:
        pass
    return jsonify({
        'status': 'healthy', 
        'service': 'timetable',
        'tesseract': {
            'configured': tesseract_configured,
            'tesseract_cmd': pytesseract.pytesseract.tesseract_cmd if tesseract_configured else None,
            'tesseract_version': tesseract_version,
        },
        'timestamp': datetime.now().isoformat()
    }), 200