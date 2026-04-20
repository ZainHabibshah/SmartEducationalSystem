from flask import Blueprint, request, jsonify, send_file, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
import os
import cv2
import numpy as np
import pytesseract
from PIL import Image
import json
import traceback
from datetime import datetime
from werkzeug.utils import secure_filename
try:
    from pypdf import PdfReader
except Exception:
    try:
        from PyPDF2 import PdfReader
    except Exception:
        PdfReader = None

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
        print(f"✅ Schedules: Tesseract OCR configured: {tesseract_cmd}")
        try:
            version = pytesseract.get_tesseract_version()
            print(f"✅ Schedules: Tesseract version: {version}")
        except:
            pass
    else:
        print("⚠️  Schedules: Tesseract OCR not found. OCR features will not work.")
except Exception as e:
    print(f"⚠️  Schedules: Tesseract configuration error: {e}")

# Initialize the embedding model
embedding_tokenizer = None
embedding_model = None
try:
    from transformers import AutoTokenizer, AutoModel
    embedding_tokenizer = AutoTokenizer.from_pretrained("BAAI/bge-base-en-v1.5")
    embedding_model = AutoModel.from_pretrained("BAAI/bge-base-en-v1.5")
    print("✅ Schedules: Embedding model loaded successfully")
except Exception as e:
    print(f"⚠️  Schedules: Embedding model not available: {e}")
    embedding_tokenizer = None
    embedding_model = None

# Create Blueprint
schedules_bp = Blueprint('schedules', __name__)

MAX_SCHEDULES = 6

def allowed_file(filename):
    """Check if file extension is allowed"""
    allowed_extensions = {'png', 'jpg', 'jpeg', 'pdf'}
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in allowed_extensions

def get_file_type(filename):
    """Determine if file is image or PDF"""
    ext = filename.rsplit('.', 1)[1].lower()
    if ext in {'png', 'jpg', 'jpeg'}:
        return 'image'
    elif ext == 'pdf':
        return 'pdf'
    return 'unknown'

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
        
        # Save processed image for debugging
        debug_path = image_path.replace('.', '_processed.')
        cv2.imwrite(debug_path, processed_image)
        print(f"💾 Saved processed image to: {debug_path}")
        
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

def extract_text_from_pdf(pdf_path):
    """Extract text from PDF for embeddings generation."""
    try:
        if PdfReader is None:
            print("⚠️  PDF reader library not available (install pypdf)")
            return None
        reader = PdfReader(pdf_path)
        pages_text = []
        for page in reader.pages:
            page_text = page.extract_text() or ""
            if page_text.strip():
                pages_text.append(page_text.strip())
        merged = "\n".join(pages_text).strip()
        if merged:
            print(f"✅ Extracted {len(merged)} characters from PDF")
            return merged
        print("⚠️  PDF text extraction returned empty content")
        return None
    except Exception as e:
        print(f"⚠️  PDF extraction failed: {e}")
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
        os.makedirs(embeddings_folder, exist_ok=True)
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

@schedules_bp.route('/upload', methods=['POST'])
@jwt_required()
def upload_schedule():
    """Upload a schedule (PDF or Image)"""
    try:
        current_user = get_jwt_identity()
        if current_user['role'] != 'admin':
            return jsonify({'error': 'Only admin can upload schedules'}), 403

        print("📨 Received schedule upload request")
        print(f"📦 Request files: {request.files}")
        
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['file']
        file_type = request.form.get('file_type', 'unknown')
        
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        print(f"📄 File received: {file.filename}")
        print(f"🔍 File type: {file_type}")
        
        if file and allowed_file(file.filename):
            # Create schedules upload folder if it doesn't exist
            upload_folder = current_app.config['SCHEDULES_UPLOAD_FOLDER']
            os.makedirs(upload_folder, exist_ok=True)
            
            # Check if we need to delete oldest schedule
            existing_files = [f for f in os.listdir(upload_folder) if allowed_file(f)]
            if len(existing_files) >= MAX_SCHEDULES:
                print(f"📊 Max schedules reached ({len(existing_files)}), deleting oldest...")
                # Sort by modification time (oldest first)
                existing_files.sort(key=lambda x: os.path.getmtime(os.path.join(upload_folder, x)))
                oldest_file = existing_files[0]
                oldest_path = os.path.join(upload_folder, oldest_file)
                os.remove(oldest_path)
                print(f"🗑️ Deleted oldest schedule: {oldest_file}")
            
            # Save new file
            filename = f"schedule_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{secure_filename(file.filename)}"
            filepath = os.path.join(upload_folder, filename)
            file.save(filepath)
            
            print(f"✅ Schedule saved: {filepath}")
            print(f"📊 File size: {os.path.getsize(filepath)} bytes")
            
            # Try to extract text and generate embeddings
            extracted_text = None
            embeddings_filename = None
            
            detected_file_type = get_file_type(filename)
            if detected_file_type in {'image', 'pdf'}:
                try:
                    # Extract text based on file type (optional)
                    if detected_file_type == 'image':
                        extracted_text = extract_text_from_image(filepath)
                    else:
                        extracted_text = extract_text_from_pdf(filepath)
                    
                    if extracted_text:
                        print(f"✅ Extracted {len(extracted_text)} characters of text")
                        
                        # Generate embeddings (optional)
                        embeddings = generate_embeddings(extracted_text)
                        
                        if embeddings:
                            # Create embeddings folder if it doesn't exist
                            embeddings_folder = os.path.join(current_app.config.get('SCHEDULES_UPLOAD_FOLDER', upload_folder), '..', 'embeddings', 'schedules')
                            os.makedirs(embeddings_folder, exist_ok=True)
                            
                            # Save embeddings to text file
                            embeddings_filename = filename.replace('.', '_') + '_embeddings.txt'
                            embeddings_path = save_embeddings_to_txt(
                                embeddings, 
                                embeddings_filename, 
                                embeddings_folder
                            )
                            print(f"✅ Embeddings saved to: {embeddings_path}")
                        else:
                            print("⚠️  Could not generate embeddings (model not available)")
                    else:
                        print("⚠️  Could not extract text from uploaded schedule file")
                except Exception as e:
                    print(f"⚠️  OCR/Embedding processing failed (non-critical): {e}")
                    traceback.print_exc()
                    # Continue anyway - schedule file is saved and can be viewed
            
            return jsonify({
                'success': True,
                'message': 'Schedule uploaded successfully',
                'filename': filename,
                'file_type': get_file_type(filename),
                'extracted_text': extracted_text if extracted_text else 'OCR not available',
                'embeddings_file': embeddings_filename if embeddings_filename else 'Embeddings not available'
            }), 200
        
        else:
            return jsonify({'error': 'Invalid file type. Allowed: PNG, JPG, PDF'}), 400
    
    except Exception as e:
        print(f"❌ Upload error: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': f'Server error: {str(e)}'}), 500

@schedules_bp.route('/list', methods=['GET'])
@jwt_required()
def list_schedules():
    """List all schedules"""
    try:
        schedules = []
        upload_folder = current_app.config['SCHEDULES_UPLOAD_FOLDER']
        
        if not os.path.exists(upload_folder):
            return jsonify({
                'success': True,
                'schedules': [],
                'count': 0
            }), 200
        
        all_files = os.listdir(upload_folder)
        print(f"📂 All files in schedules folder: {all_files}")
        
        for filename in all_files:
            if allowed_file(filename):
                filepath = os.path.join(upload_folder, filename)
                file_stats = os.stat(filepath)
                
                schedules.append({
                    'id': filename,
                    'filename': filename,
                    'file_type': get_file_type(filename),
                    'upload_date': datetime.fromtimestamp(file_stats.st_mtime).isoformat(),
                    'size': file_stats.st_size
                })
        
        # Sort by upload date (newest first)
        schedules.sort(key=lambda x: x['upload_date'], reverse=True)
        
        return jsonify({
            'success': True,
            'schedules': schedules,
            'count': len(schedules)
        }), 200
    
    except Exception as e:
        print(f"❌ List schedules error: {str(e)}")
        return jsonify({'error': f'Server error: {str(e)}'}), 500

@schedules_bp.route('/view/<filename>', methods=['GET'])
def view_schedule(filename):
    """View a schedule file (for display in app)"""
    try:
        filepath = os.path.join(current_app.config['SCHEDULES_UPLOAD_FOLDER'], filename)
        
        if not os.path.exists(filepath):
            return jsonify({'error': f'File not found: {filename}'}), 404
        
        # Determine MIME type
        ext = filename.rsplit('.', 1)[-1].lower()
        mimetype_map = {
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
            'pdf': 'application/pdf'
        }
        mimetype = mimetype_map.get(ext, 'application/octet-stream')
        
        return send_file(filepath, mimetype=mimetype)
    
    except Exception as e:
        print(f"❌ View schedule error: {str(e)}")
        return jsonify({'error': f'Server error: {str(e)}'}), 500

@schedules_bp.route('/download/<filename>', methods=['GET'])
def download_schedule(filename):
    """Download a schedule file"""
    try:
        print(f"🔍 Looking for file: {filename}")
        
        filepath = os.path.join(current_app.config['SCHEDULES_UPLOAD_FOLDER'], filename)
        print(f"📁 Checking path: {filepath}")
        
        if not os.path.exists(filepath):
            upload_folder = current_app.config['SCHEDULES_UPLOAD_FOLDER']
            all_files = os.listdir(upload_folder) if os.path.exists(upload_folder) else []
            print(f"📂 All files in upload folder: {all_files}")
            
            return jsonify({
                'error': f'File not found: {filename}',
                'searched_path': filepath,
                'available_files': all_files,
            }), 404
        
        print(f"✅ File found: {filepath}")
        
        # Determine MIME type
        ext = filename.rsplit('.', 1)[-1].lower()
        mimetype_map = {
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
            'pdf': 'application/pdf'
        }
        mimetype = mimetype_map.get(ext, 'application/octet-stream')
        
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

@schedules_bp.route('/delete/<filename>', methods=['DELETE'])
@jwt_required()
def delete_schedule(filename):
    """Delete a schedule file"""
    try:
        current_user = get_jwt_identity()
        if current_user['role'] != 'admin':
            return jsonify({'error': 'Only admin can delete schedules'}), 403
        
        print(f"🗑️ Delete request for: {filename}")
        
        filepath = os.path.join(current_app.config['SCHEDULES_UPLOAD_FOLDER'], filename)
        if not os.path.exists(filepath):
            return jsonify({
                'error': f'Schedule not found: {filename}',
                'available_files': os.listdir(current_app.config['SCHEDULES_UPLOAD_FOLDER'])
            }), 404
        
        # Delete the file
        os.remove(filepath)
        print(f"✅ Deleted schedule: {filepath}")

        # Delete related embeddings file if present
        try:
            embeddings_folder = os.path.join(current_app.config['SCHEDULES_UPLOAD_FOLDER'], '..', 'embeddings', 'schedules')
            embeddings_filename = filename.replace('.', '_') + '_embeddings.txt'
            embeddings_path = os.path.join(embeddings_folder, embeddings_filename)
            if os.path.exists(embeddings_path):
                os.remove(embeddings_path)
                print(f"✅ Deleted schedule embeddings file: {embeddings_path}")
        except Exception as emb_err:
            print(f"⚠️  Could not remove schedule embeddings file for {filename}: {emb_err}")

        # Remove corresponding vectors from chatbot Chroma store
        try:
            from chatbot.routes import get_rag_pipeline
            pipeline = get_rag_pipeline()
            if pipeline:
                pipeline.remove_vectors_for_file(source="schedule", upload_filename=filename)
        except Exception as vec_err:
            print(f"⚠️  Could not remove schedule vectors for {filename}: {vec_err}")
        
        return jsonify({
            'success': True,
            'message': f'Schedule deleted successfully',
            'filename': filename
        }), 200
    
    except Exception as e:
        print(f"❌ Delete error: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': f'Server error: {str(e)}'}), 500

@schedules_bp.route('/health', methods=['GET'])
def schedules_health_check():
    """Health check endpoint for schedules service"""
    return jsonify({
        'status': 'healthy',
        'service': 'schedules',
        'timestamp': datetime.now().isoformat()
    }), 200
