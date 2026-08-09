# Smart Educational Companion 🎓

**Smart Educational Companion (SEC)** is an AI-powered educational platform developed as a Final Year Project to provide students with a smarter, more personalized, and interactive learning experience.

The system combines academic management, AI-powered assistance, curriculum-based learning, quizzes, attendance, notifications, and productivity features into a single platform. The project was designed to address common challenges faced by students, including difficulty managing academic activities, accessing personalized learning support, and organizing study resources.

## 🚀 Features

* 🤖 AI-powered educational chatbot
* 📚 Curriculum-based learning
* 📝 Interactive quizzes
* 📊 Attendance management
* 🔔 Academic notifications
* 🗓️ Timetable and schedule management
* 🏆 Student achievements and gamification
* 👨‍🎓 Student management
* 👨‍💼 Admin management
* 📖 Learning resources
* 🔎 AI-powered information retrieval
* 🔐 User authentication
* 💾 Persistent data management

## 🧠 AI & RAG

The Smart Educational Companion integrates AI to provide students with educational assistance based on relevant learning resources.

The project uses a **Retrieval-Augmented Generation (RAG)** approach to retrieve relevant information from educational content before generating responses. This helps the chatbot provide more context-aware and curriculum-focused answers.

### AI Components

* Generative AI
* Retrieval-Augmented Generation (RAG)
* ChromaDB
* Embedding Models
* Groq API
* Tesseract OCR

## 🛠️ Technology Stack

### Mobile Application

* React Native
* Expo

### Backend

* Flask
* Python

### Database

* MongoDB
* Firebase

### AI

* Generative AI
* RAG
* ChromaDB
* Embeddings
* Groq API
* Tesseract

## 📂 Project Structure

```text
SmartEducationalSystem/
│
├── Backend/
│   ├── AI/
│   ├── APIs/
│   ├── Database/
│   └── Backend Services/
│
├── Frontend/
│   ├── app/
│   ├── components/
│   ├── assets/
│   └── screens/
│
├── Commands.txt
├── Issues.txt
├── .gitignore
└── README.md
```

## ⚙️ Installation

### Backend

Navigate to the backend directory:

```bash
cd Backend
```

Install the required Python dependencies:

```bash
pip install -r requirements.txt
```

Additional AI-related dependencies/services used by the project include:

* Tesseract
* ChromaDB
* Embedding Model

### Frontend

Navigate to the frontend directory:

```bash
cd Frontend
```

Install the dependencies:

```bash
npm install
```

Start the Expo development server:

```bash
npx expo start
```

## 🔐 Environment Variables

Create a `.env` file and configure the required credentials:

```env
API_KEY=your_groq_api_key
MONGODB_URI=your_mongodb_connection
FIREBASE_CONFIG=your_firebase_configuration
```

Do not commit API keys, database credentials, or other sensitive information to the repository.

## 🏗️ System Overview

```text
             ┌──────────────────────┐
             │   React Native App   │
             │      Frontend        │
             └──────────┬───────────┘
                        │
                        ▼
             ┌──────────────────────┐
             │    Flask Backend     │
             │     REST APIs        │
             └───────┬───────┬──────┘
                     │       │
              ┌──────▼───┐ ┌─▼─────────────┐
              │ MongoDB  │ │   Firebase    │
              └──────────┘ └───────────────┘
                     │
                     ▼
             ┌──────────────────────┐
             │    AI / RAG Layer    │
             │                      │
             │ Groq API             │
             │ ChromaDB             │
             │ Embeddings           │
             │ Tesseract OCR        │
             └──────────────────────┘
```

## 🎯 Project Objectives

The main objectives of Smart Educational Companion are to:

* Provide personalized educational assistance.
* Make curriculum-based learning more accessible.
* Help students manage their academic activities.
* Improve student engagement through interactive learning.
* Provide AI-powered support for educational queries.
* Centralize important academic information in one platform.
* Reduce the effort required to manage everyday academic activities.

## 📱 Target Users

The system is designed primarily for:

* Students
* Teachers
* Academic administrators
* Educational institutions

The project has been developed with educational use cases including students from **The EAST School and College, Jehangira**, as well as students of **COMSATS University Islamabad**.

## 📚 What I Learned

Developing this project provided practical experience in:

* Full-stack application development
* React Native development
* Flask backend development
* REST API development
* MongoDB integration
* Firebase integration
* Generative AI integration
* Retrieval-Augmented Generation
* Vector databases
* Embedding-based information retrieval
* OCR integration
* UI/UX design
* Software architecture
* Testing and debugging
* Git and GitHub

## 👨‍💻 Project Information

**Project:** Smart Educational Companion
**Type:** Final Year Project
**Field:** Software Engineering
**Platform:** Mobile Application
**Architecture:** Full Stack + AI/RAG

## 👥 Team

Developed as a Final Year Project by:

**Zain Habib**
**Humaira Kauser**

## 🔮 Future Improvements

Future versions can include:

* More advanced personalized learning
* Voice-based AI assistance
* Improved recommendation systems
* Real-time collaboration
* Expanded curriculum support
* Advanced learning analytics
* More AI-powered educational tools

---

⭐ **Smart Educational Companion — Making learning smarter through AI and technology.**
