"""
RAG Pipeline for Chatbot
Handles retrieval-augmented generation for timetable, schedules, and attendance topics
"""
import os
from datetime import datetime
from typing import List, Dict, Optional, Tuple
try:
    from langchain_community.embeddings import HuggingFaceEmbeddings
    from langchain_community.vectorstores import Chroma
    try:
        from langchain_text_splitters import RecursiveCharacterTextSplitter
    except ImportError:
        from langchain.text_splitter import RecursiveCharacterTextSplitter
    # RetrievalQA is deprecated in LangChain 1.x, we'll use create_retrieval_chain instead
    RetrievalQA = None  # Will use alternative approach
    try:
        from langchain.chains.combine_documents import create_stuff_documents_chain
        from langchain.chains import create_retrieval_chain
        HAS_RETRIEVAL_CHAIN = True
    except ImportError:
        HAS_RETRIEVAL_CHAIN = False
        try:
            # Fallback to old RetrievalQA if available
            from langchain.chains.retrieval_qa.base import RetrievalQA
        except ImportError:
            try:
                from langchain.chains import RetrievalQA
            except ImportError:
                RetrievalQA = None
    try:
        from langchain_core.prompts import PromptTemplate
    except ImportError:
        from langchain.prompts import PromptTemplate
    try:
        from langchain_core.documents import Document
    except ImportError:
        from langchain.schema import Document
    import chromadb
    from chromadb.config import Settings
    
    # Try different Groq import paths
    try:
        from langchain_groq import ChatGroq
        Groq = ChatGroq  # Use ChatGroq as Groq
    except ImportError:
        try:
            from langchain_community.llms import Groq
        except ImportError:
            try:
                from langchain.llms import Groq
            except ImportError:
                Groq = None
                print("WARNING: Chatbot: Groq LLM not available in LangChain")
except ImportError:
    # Fallback for older langchain versions
    try:
        from langchain.embeddings import HuggingFaceEmbeddings
        from langchain.vectorstores import Chroma
        from langchain.text_splitter import RecursiveCharacterTextSplitter
        from langchain.chains import RetrievalQA
        from langchain.prompts import PromptTemplate
        from langchain.schema import Document
        import chromadb
        from chromadb.config import Settings
        
        try:
            from langchain.llms import Groq
        except ImportError:
            Groq = None
    except ImportError:
        print("WARNING: Chatbot: LangChain or ChromaDB not installed")
        HuggingFaceEmbeddings = None
        Chroma = None
        RecursiveCharacterTextSplitter = None
        RetrievalQA = None
        Groq = None
        PromptTemplate = None
        Document = None
        chromadb = None
        Settings = None
import json
import traceback

# Initialize embedding model (reuse the same model as schedules)
EMBEDDING_MODEL_NAME = "BAAI/bge-base-en-v1.5"

class RAGPipeline:
    def __init__(self, chroma_db_path: str = None):
        """Initialize RAG pipeline with embedding model and ChromaDB"""
        self.embeddings = None
        self.timetable_store = None
        self.schedules_store = None
        self.attendance_store = None
        self.llm = None
        self.chroma_client = None
        self.chroma_db_path = chroma_db_path or os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            'chroma_db'
        )
        # Create ChromaDB folder immediately
        try:
            os.makedirs(self.chroma_db_path, exist_ok=True)
            print(f"✅ Chatbot: ChromaDB folder created/verified at {self.chroma_db_path}")
        except Exception as e:
            print(f"⚠️  Chatbot: Failed to create ChromaDB folder: {e}")
        
        self._initialize_chromadb()
        self._initialize_embeddings()
        self._initialize_llm()
    
    def _initialize_chromadb(self):
        """Initialize ChromaDB client for local storage"""
        try:
            if chromadb is None:
                print("WARNING: Chatbot: ChromaDB not available - install with: pip install chromadb")
                return
            
            # Ensure folder exists
            os.makedirs(self.chroma_db_path, exist_ok=True)
            
            # Create ChromaDB client with local persistence
            if Settings:
                self.chroma_client = chromadb.PersistentClient(
                    path=self.chroma_db_path,
                    settings=Settings(
                        anonymized_telemetry=False,
                        allow_reset=True
                    )
                )
            else:
                # Fallback for older ChromaDB versions
                self.chroma_client = chromadb.PersistentClient(path=self.chroma_db_path)
            
            print(f"✅ Chatbot: ChromaDB initialized at {self.chroma_db_path}")
            print(f"✅ Chatbot: ChromaDB folder exists: {os.path.exists(self.chroma_db_path)}")
            
            # Try to load existing collections
            self._load_existing_collections()
        except Exception as e:
            print(f"⚠️  Chatbot: Failed to initialize ChromaDB: {e}")
            import traceback
            traceback.print_exc()
            self.chroma_client = None
    
    def _load_existing_collections(self):
        """Load existing ChromaDB collections if they exist"""
        try:
            if not self.chroma_client or not self.embeddings or Chroma is None:
                return
            
            # Try to load timetable collection
            try:
                collection = self.chroma_client.get_collection(name="timetable")
                if collection.count() > 0:
                    self.timetable_store = Chroma(
                        client=self.chroma_client,
                        collection_name="timetable",
                        embedding_function=self.embeddings
                    )
                    print(f"✅ Chatbot: Loaded existing timetable collection ({collection.count()} documents)")
            except:
                pass
            
            # Try to load schedules collection
            try:
                collection = self.chroma_client.get_collection(name="schedules")
                if collection.count() > 0:
                    self.schedules_store = Chroma(
                        client=self.chroma_client,
                        collection_name="schedules",
                        embedding_function=self.embeddings
                    )
                    print(f"✅ Chatbot: Loaded existing schedules collection ({collection.count()} documents)")
            except:
                pass
            
            # Attendance collection is loaded dynamically per user, so we don't load it here
        except Exception as e:
            print(f"⚠️  Chatbot: Error loading existing collections: {e}")
    
    def _initialize_embeddings(self):
        """Initialize HuggingFace embeddings"""
        try:
            if HuggingFaceEmbeddings is None:
                print("⚠️  Chatbot: HuggingFaceEmbeddings not available")
                return
            self.embeddings = HuggingFaceEmbeddings(
                model_name=EMBEDDING_MODEL_NAME,
                model_kwargs={'device': 'cpu'},
                encode_kwargs={'normalize_embeddings': True}
            )
            print("✅ Chatbot: Embedding model initialized")
        except Exception as e:
            print(f"⚠️  Chatbot: Failed to initialize embeddings: {e}")
            self.embeddings = None
    
    def _initialize_llm(self):
        """Initialize Groq LLM"""
        try:
            if Groq is None:
                print("WARNING: Chatbot: Groq LLM not available")
                return
            groq_api_key = os.getenv("GROQ_API_KEY")
            if not groq_api_key:
                print("WARNING: Chatbot: GROQ_API_KEY not found in environment")
                return
            
            # Check if it's ChatGroq (newer) or Groq (older)
            try:
                from langchain_groq import ChatGroq
                # Use ChatGroq (newer API)
                self.llm = ChatGroq(
                    model="llama-3.1-8b-instant",
                    groq_api_key=groq_api_key,
                    temperature=0.3,
                    max_tokens=200
                )
            except ImportError:
                # Fallback to old Groq API
                self.llm = Groq(
                    model_name="llama-3.1-8b-instant",
                    groq_api_key=groq_api_key,
                    temperature=0.3,
                    max_tokens=200
                )
            print("✅ Chatbot: LLM initialized")
        except Exception as e:
            print(f"⚠️  Chatbot: Failed to initialize LLM: {e}")
            import traceback
            traceback.print_exc()
            self.llm = None
    
    def load_timetable_embeddings(self, embeddings_folder: str):
        """Load timetable embeddings from files and store in ChromaDB"""
        try:
            if not self.embeddings or Document is None or Chroma is None or not self.chroma_client:
                print("⚠️  Chatbot: Required components not available")
                return False
            
            documents = []
            if os.path.exists(embeddings_folder):
                for filename in os.listdir(embeddings_folder):
                    if filename.endswith('_embeddings.txt'):
                        filepath = os.path.join(embeddings_folder, filename)
                        try:
                            with open(filepath, 'r', encoding='utf-8') as f:
                                content = f.read()
                                # Parse embeddings file - format: === key ===\nText: ...\nEmbedding: ...
                                current_text = None
                                for line in content.split('\n'):
                                    line = line.strip()
                                    if line.startswith('Text:'):
                                        current_text = line.replace('Text:', '').strip()
                                    elif line.startswith('===') and current_text:
                                        # Save previous text if exists
                                        if current_text and len(current_text) > 10:  # Minimum length
                                            documents.append(Document(
                                                page_content=current_text,
                                                metadata={"source": "timetable", "file": filename}
                                            ))
                                        current_text = None
                                    elif current_text and not line.startswith('Embedding:'):
                                        # Continue building text if it's a continuation
                                        if line:
                                            current_text += " " + line
                                
                                # Save last text if exists
                                if current_text and len(current_text) > 10:
                                    documents.append(Document(
                                        page_content=current_text,
                                        metadata={"source": "timetable", "file": filename}
                                    ))
                        except Exception as e:
                            print(f"⚠️  Error reading {filename}: {e}")
                            continue
            
            if documents and RecursiveCharacterTextSplitter:
                # Split documents into chunks
                text_splitter = RecursiveCharacterTextSplitter(
                    chunk_size=500,
                    chunk_overlap=50
                )
                texts = text_splitter.split_documents(documents)
                
                # Create or get ChromaDB collection for timetable
                collection_name = "timetable"
                try:
                    # Try to get existing collection
                    collection = self.chroma_client.get_collection(name=collection_name)
                    # If collection exists and has data, use it; otherwise delete and recreate
                    if collection.count() > 0:
                        # Load existing collection
                        self.timetable_store = Chroma(
                            client=self.chroma_client,
                            collection_name=collection_name,
                            embedding_function=self.embeddings
                        )
                        print(f"✅ Chatbot: Using existing timetable collection with {collection.count()} documents")
                        return True
                    else:
                        # Empty collection, delete and recreate
                        self.chroma_client.delete_collection(name=collection_name)
                except:
                    pass
                
                # Create new collection
                collection = self.chroma_client.create_collection(
                    name=collection_name,
                    metadata={"description": "Timetable embeddings for chatbot"}
                )
                
                # Store in ChromaDB via LangChain
                self.timetable_store = Chroma.from_documents(
                    documents=texts,
                    embedding=self.embeddings,
                    client=self.chroma_client,
                    collection_name=collection_name,
                    persist_directory=self.chroma_db_path
                )
                print(f"✅ Chatbot: Loaded {len(documents)} timetable documents into ChromaDB")
                return True
            else:
                if not documents:
                    print("⚠️  Chatbot: No timetable documents found")
                return False
        except Exception as e:
            print(f"⚠️  Chatbot: Error loading timetable embeddings: {e}")
            traceback.print_exc()
            return False
    
    def load_schedules_embeddings(self, embeddings_folder: str):
        """Load schedules embeddings from files and store in ChromaDB"""
        try:
            if not self.embeddings or Document is None or Chroma is None or not self.chroma_client:
                return False
            
            documents = []
            if os.path.exists(embeddings_folder):
                for filename in os.listdir(embeddings_folder):
                    if filename.endswith('_embeddings.txt'):
                        filepath = os.path.join(embeddings_folder, filename)
                        try:
                            with open(filepath, 'r', encoding='utf-8') as f:
                                content = f.read()
                                # Parse embeddings file - format: === key ===\nText: ...\nEmbedding: ...
                                current_text = None
                                for line in content.split('\n'):
                                    line = line.strip()
                                    if line.startswith('Text:'):
                                        current_text = line.replace('Text:', '').strip()
                                    elif line.startswith('===') and current_text:
                                        if current_text and len(current_text) > 10:
                                            documents.append(Document(
                                                page_content=current_text,
                                                metadata={"source": "schedule", "file": filename}
                                            ))
                                        current_text = None
                                    elif current_text and not line.startswith('Embedding:'):
                                        if line:
                                            current_text += " " + line
                                
                                if current_text and len(current_text) > 10:
                                    documents.append(Document(
                                        page_content=current_text,
                                        metadata={"source": "schedule", "file": filename}
                                    ))
                        except Exception as e:
                            print(f"⚠️  Error reading {filename}: {e}")
                            continue
            
            if documents and RecursiveCharacterTextSplitter:
                text_splitter = RecursiveCharacterTextSplitter(
                    chunk_size=500,
                    chunk_overlap=50
                )
                texts = text_splitter.split_documents(documents)
                
                # Create or get ChromaDB collection for schedules
                collection_name = "schedules"
                try:
                    collection = self.chroma_client.get_collection(name=collection_name)
                    if collection.count() > 0:
                        self.schedules_store = Chroma(
                            client=self.chroma_client,
                            collection_name=collection_name,
                            embedding_function=self.embeddings
                        )
                        print(f"✅ Chatbot: Using existing schedules collection with {collection.count()} documents")
                        return True
                    else:
                        self.chroma_client.delete_collection(name=collection_name)
                except:
                    pass
                
                collection = self.chroma_client.create_collection(
                    name=collection_name,
                    metadata={"description": "Schedule embeddings for chatbot"}
                )
                
                self.schedules_store = Chroma.from_documents(
                    documents=texts,
                    embedding=self.embeddings,
                    client=self.chroma_client,
                    collection_name=collection_name,
                    persist_directory=self.chroma_db_path
                )
                print(f"✅ Chatbot: Loaded {len(documents)} schedule documents into ChromaDB")
                return True
            else:
                if not documents:
                    print("⚠️  Chatbot: No schedule documents found")
                return False
        except Exception as e:
            print(f"⚠️  Chatbot: Error loading schedules embeddings: {e}")
            traceback.print_exc()
            return False
    
    def load_attendance_topics(self, db, user_email: str, user_role: str, user_course: Optional[str] = None):
        """Load attendance topics from MongoDB"""
        try:
            if not self.embeddings or Document is None:
                return False
            
            documents = []
            
            if user_role == 'admin' and user_course:
                # Admin: Get topics from their attendance_topics array
                admin_collection = db.admin
                admin = admin_collection.find_one({"email": user_email})
                if admin and 'attendance_topics' in admin:
                    for entry in admin['attendance_topics']:
                        date = entry.get('date', '')
                        topics = entry.get('topics', {})
                        course = entry.get('course', '')
                        
                        # Format topics into text
                        topic_texts = []
                        for course_key, topic_list in topics.items():
                            if isinstance(topic_list, list):
                                topic_texts.extend(topic_list)
                            elif isinstance(topic_list, str):
                                topic_texts.append(topic_list)
                        
                        if topic_texts:
                            text = f"On {date}, topics covered in {course}: {', '.join(topic_texts)}"
                            documents.append(Document(
                                page_content=text,
                                metadata={"source": "attendance", "date": date, "course": course}
                            ))
            
            elif user_role == 'student':
                # Student: Get topics from their attendance records
                students_collection = None
                if user_course:
                    from database import get_course_collection
                    try:
                        students_collection = get_course_collection(db, user_course)
                    except:
                        pass
                
                if students_collection:
                    student = students_collection.find_one({"email": user_email})
                    if student and 'attendance' in student:
                        for record in student['attendance']:
                            date = record.get('date', '')
                            topics = record.get('topics', {})
                            
                            topic_texts = []
                            for course_key, topic_list in topics.items():
                                if isinstance(topic_list, list):
                                    topic_texts.extend(topic_list)
                                elif isinstance(topic_list, str):
                                    topic_texts.append(topic_list)
                            
                            if topic_texts:
                                text = f"On {date}, topics covered: {', '.join(topic_texts)}"
                                documents.append(Document(
                                    page_content=text,
                                    metadata={"source": "attendance", "date": date}
                                ))
            
            if documents and RecursiveCharacterTextSplitter and Chroma:
                text_splitter = RecursiveCharacterTextSplitter(
                    chunk_size=500,
                    chunk_overlap=50
                )
                texts = text_splitter.split_documents(documents)
                
                # Create or get ChromaDB collection for attendance
                collection_name = "attendance"
                try:
                    collection = self.chroma_client.get_collection(name=collection_name)
                    if collection.count() > 0:
                        self.attendance_store = Chroma(
                            client=self.chroma_client,
                            collection_name=collection_name,
                            embedding_function=self.embeddings
                        )
                        print(f"✅ Chatbot: Using existing attendance collection with {collection.count()} documents")
                        return True
                    else:
                        self.chroma_client.delete_collection(name=collection_name)
                except:
                    pass
                
                collection = self.chroma_client.create_collection(
                    name=collection_name,
                    metadata={"description": "Attendance topics embeddings for chatbot"}
                )
                
                self.attendance_store = Chroma.from_documents(
                    documents=texts,
                    embedding=self.embeddings,
                    client=self.chroma_client,
                    collection_name=collection_name,
                    persist_directory=self.chroma_db_path
                )
                print(f"✅ Chatbot: Loaded {len(documents)} attendance topic documents into ChromaDB")
                return True
            else:
                if not documents:
                    print("⚠️  Chatbot: No attendance topics found")
                return False
        except Exception as e:
            print(f"⚠️  Chatbot: Error loading attendance topics: {e}")
            traceback.print_exc()
            return False
    
    def classify_query(self, query: str) -> str:
        """Classify query type: timetable, schedule, attendance, or out_of_scope"""
        query_lower = query.lower()
        
        # Timetable keywords
        timetable_keywords = [
            'class', 'where is my class', 'what class', 'when is class', 
            'timetable', 'schedule', 'time', 'period', 'subject', 'teacher',
            'room', 'location', 'now', 'current', 'today'
        ]
        
        # Schedule keywords
        schedule_keywords = [
            'schedule', 'what topics', 'what did we study', 'what did we read',
            'topics covered', 'syllabus', 'curriculum'
        ]
        
        # Attendance keywords
        attendance_keywords = [
            'attendance', 'topics', 'what topics', 'studied', 'covered',
            'learned', 'read', 'taught'
        ]
        
        timetable_score = sum(1 for kw in timetable_keywords if kw in query_lower)
        schedule_score = sum(1 for kw in schedule_keywords if kw in query_lower)
        attendance_score = sum(1 for kw in attendance_keywords if kw in query_lower)
        
        # Check for time/date related queries (likely timetable)
        if any(word in query_lower for word in ['now', 'current', 'today', 'when', 'what time']):
            timetable_score += 2
        
        # Determine query type
        max_score = max(timetable_score, schedule_score, attendance_score)
        
        if max_score == 0:
            return "out_of_scope"
        elif timetable_score == max_score:
            return "timetable"
        elif attendance_score == max_score:
            return "attendance"
        else:
            return "schedule"
    
    def get_current_time_context(self) -> str:
        """Get current time and date context"""
        now = datetime.now()
        current_time = now.strftime("%H:%M")
        current_date = now.strftime("%Y-%m-%d")
        day_name = now.strftime("%A")
        return f"Current date: {current_date} ({day_name}), Current time: {current_time}"
    
    def query_timetable(self, question: str) -> Optional[str]:
        """Query timetable with time context"""
        if not self.timetable_store or not self.llm or RetrievalQA is None or PromptTemplate is None:
            return None
        
        try:
            # Add time context to question
            time_context = self.get_current_time_context()
            enhanced_question = f"{question}. {time_context}"
            
            # Create retrieval chain from ChromaDB
            retriever = self.timetable_store.as_retriever(search_kwargs={"k": 3})
            
            prompt_template = """You are a helpful assistant that answers questions about class timetables.
Use the following context to answer the question. Consider the current time and date when answering.

Context: {context}
Current Time Context: {time_context}

Question: {question}

Provide a short, clear answer. If the information is not in the context, say you don't have that information.

Answer:"""
            
            prompt = PromptTemplate(
                template=prompt_template,
                input_variables=["context", "question", "time_context"]
            )
            
            qa_chain = RetrievalQA.from_chain_type(
                llm=self.llm,
                chain_type="stuff",
                retriever=retriever,
                chain_type_kwargs={"prompt": prompt},
                return_source_documents=True
            )
            
            result = qa_chain({"query": enhanced_question})
            return result['result']
        except Exception as e:
            print(f"⚠️  Error querying timetable: {e}")
            traceback.print_exc()
            return None
    
    def query_schedules(self, question: str) -> Optional[str]:
        """Query schedules"""
        if not self.schedules_store or not self.llm or RetrievalQA is None or PromptTemplate is None:
            return None
        
        try:
            # Create retrieval chain from ChromaDB
            retriever = self.schedules_store.as_retriever(search_kwargs={"k": 3})
            
            prompt_template = """You are a helpful assistant that answers questions about schedules and curriculum.
Use the following context to answer the question.

Context: {context}

Question: {question}

Provide a short, clear answer. If the information is not in the context, say you don't have that information.

Answer:"""
            
            prompt = PromptTemplate(
                template=prompt_template,
                input_variables=["context", "question"]
            )
            
            qa_chain = RetrievalQA.from_chain_type(
                llm=self.llm,
                chain_type="stuff",
                retriever=retriever,
                chain_type_kwargs={"prompt": prompt},
                return_source_documents=True
            )
            
            result = qa_chain({"query": question})
            return result['result']
        except Exception as e:
            print(f"⚠️  Error querying schedules: {e}")
            return None
    
    def query_attendance_topics(self, question: str) -> Optional[str]:
        """Query attendance topics"""
        if not self.attendance_store or not self.llm or RetrievalQA is None or PromptTemplate is None:
            return None
        
        try:
            # Create retrieval chain from ChromaDB
            retriever = self.attendance_store.as_retriever(search_kwargs={"k": 5})
            
            prompt_template = """You are a helpful assistant that answers questions about topics that were covered in class.
Use the following context to answer the question. Only answer about topics that are mentioned in the context.

Context: {context}

Question: {question}

Provide a short, clear answer. If the topic is not in the context (meaning it hasn't been studied yet), politely apologize and say that topic hasn't been covered yet.

Answer:"""
            
            prompt = PromptTemplate(
                template=prompt_template,
                input_variables=["context", "question"]
            )
            
            qa_chain = RetrievalQA.from_chain_type(
                llm=self.llm,
                chain_type="stuff",
                retriever=retriever,
                chain_type_kwargs={"prompt": prompt},
                return_source_documents=True
            )
            
            result = qa_chain({"query": question})
            return result['result']
        except Exception as e:
            print(f"⚠️  Error querying attendance topics: {e}")
            return None
    
    def answer_question(self, question: str, user_email: str, user_role: str, user_course: Optional[str] = None, db=None) -> Dict:
        """Main method to answer questions using RAG"""
        try:
            # Reload attendance topics (they change frequently)
            if db:
                self.load_attendance_topics(db, user_email, user_role, user_course)
            
            # Classify query
            query_type = self.classify_query(question)
            
            if query_type == "out_of_scope":
                return {
                    "answer": "I apologize, but I can only answer questions related to timetables, schedules, and topics covered in class. Please ask me about your class schedule, timetable, or topics that have been taught.",
                    "query_type": "out_of_scope",
                    "sources": []
                }
            
            # Route to appropriate handler
            answer = None
            sources = []
            
            if query_type == "timetable":
                answer = self.query_timetable(question)
            elif query_type == "schedule":
                answer = self.query_schedules(question)
            elif query_type == "attendance":
                answer = self.query_attendance_topics(question)
            
            if not answer:
                return {
                    "answer": "I apologize, but I couldn't find relevant information to answer your question. Please make sure the data is available.",
                    "query_type": query_type,
                    "sources": []
                }
            
            return {
                "answer": answer,
                "query_type": query_type,
                "sources": sources
            }
        except Exception as e:
            print(f"⚠️  Error answering question: {e}")
            traceback.print_exc()
            return {
                "answer": "I apologize, but I encountered an error processing your question. Please try again.",
                "query_type": "error",
                "sources": []
            }
