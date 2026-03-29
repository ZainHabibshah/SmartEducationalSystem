# verify_installation.py
import importlib
import sys

def check_module(module_name, package_name=None):
    try:
        if package_name is None:
            package_name = module_name
        importlib.import_module(module_name)
        print(f"✅ {package_name} - OK")
        return True
    except ImportError as e:
        print(f"❌ {package_name} - FAILED: {e}")
        return False

def main():
    print("Checking Flask and Authentication Dependencies...")
    flask_modules = [
        ('flask', 'Flask'),
        ('flask_cors', 'flask-cors'),
        ('flask_jwt_extended', 'flask-jwt-extended'),
        ('jwt', 'PyJWT'),
    ]
    
    print("\nChecking Image Processing Dependencies...")
    image_modules = [
        ('cv2', 'opencv-python'),
        ('PIL', 'Pillow'),
        ('pytesseract', 'pytesseract'),
    ]
    
    print("\nChecking ML & Embeddings Dependencies...")
    ml_modules = [
        ('sentence_transformers', 'sentence-transformers'),
        ('torch', 'torch'),
        ('transformers', 'transformers'),
        ('numpy', 'numpy'),
        ('sklearn', 'scikit-learn'),
    ]
    
    print("\nChecking PDF & Utility Dependencies...")
    utility_modules = [
        ('reportlab', 'reportlab'),
        ('dateutil', 'python-dateutil'),
        ('requests', 'requests'),
    ]
    
    all_modules = flask_modules + image_modules + ml_modules + utility_modules
    
    success = True
    for module_name, package_name in all_modules:
        if not check_module(module_name, package_name):
            success = False
    
    if success:
        print("\n🎉 All dependencies installed successfully!")
    else:
        print("\n⚠️  Some dependencies failed to install. Please check the errors above.")
        
    # Check Tesseract
    try:
        import pytesseract
        pytesseract.get_tesseract_version()
        print("✅ Tesseract OCR - OK")
    except Exception as e:
        print(f"❌ Tesseract OCR - FAILED: {e}")
        print("Please install Tesseract OCR system package")

if __name__ == "__main__":
    main()