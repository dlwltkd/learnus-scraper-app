import os
from sqlalchemy import create_engine, Column, Integer, String, Boolean, DateTime, ForeignKey, Text, UniqueConstraint
from sqlalchemy.orm import declarative_base, relationship, sessionmaker
from datetime import datetime

Base = declarative_base()

class User(Base):
    __tablename__ = 'users'
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    
    # API Auth
    api_token = Column(String, unique=True, index=True, nullable=True)
    push_token = Column(String, nullable=True)
    
    # Moodle Credentials/Session
    moodle_username = Column(String, nullable=True)
    moodle_password = Column(String, nullable=True)
    moodle_cookies = Column(Text, nullable=True) # JSON
    
    courses = relationship("Course", back_populates="owner", cascade="all, delete-orphan")

class Course(Base):
    __tablename__ = 'courses'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    moodle_id = Column(Integer, index=True)
    owner_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    
    name = Column(String)
    last_updated = Column(DateTime, default=datetime.now)
    is_active = Column(Boolean, default=True)
    
    owner = relationship("User", back_populates="courses")
    
    assignments = relationship("Assignment", back_populates="course", cascade="all, delete-orphan")
    vods = relationship("VOD", back_populates="course", cascade="all, delete-orphan")
    files = relationship("FileResource", back_populates="course", cascade="all, delete-orphan")
    boards = relationship("Board", back_populates="course", cascade="all, delete-orphan")
    
    __table_args__ = (UniqueConstraint('moodle_id', 'owner_id', name='_user_moodle_course_uc'),)

class Assignment(Base):
    __tablename__ = 'assignments'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    moodle_id = Column(Integer)
    course_id = Column(Integer, ForeignKey('courses.id'))
    
    title = Column(String)
    due_date = Column(String)
    is_completed = Column(Boolean, default=False)
    url = Column(String)
    
    course = relationship("Course", back_populates="assignments")

class VOD(Base):
    __tablename__ = 'vods'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    moodle_id = Column(Integer)
    course_id = Column(Integer, ForeignKey('courses.id'))
    
    title = Column(String)
    start_date = Column(String)
    end_date = Column(String)
    is_completed = Column(Boolean, default=False)
    has_tracking = Column(Boolean, default=True)
    url = Column(String)
    
    course = relationship("Course", back_populates="vods")

class FileResource(Base):
    __tablename__ = 'files'
    id = Column(Integer, primary_key=True, autoincrement=True)
    moodle_id = Column(Integer)
    course_id = Column(Integer, ForeignKey('courses.id'))
    
    title = Column(String)
    url = Column(String)
    
    is_completed = Column(Boolean, default=False)
    local_path = Column(String, nullable=True)
    
    course = relationship("Course", back_populates="files")

class Board(Base):
    __tablename__ = 'boards'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    moodle_id = Column(Integer)
    course_id = Column(Integer, ForeignKey('courses.id'))
    
    title = Column(String)
    url = Column(String)
    
    course = relationship("Course", back_populates="boards")
    posts = relationship("Post", back_populates="board", cascade="all, delete-orphan")

class Post(Base):
    __tablename__ = 'posts'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    board_id = Column(Integer, ForeignKey('boards.id'))
    
    title = Column(String)
    writer = Column(String)
    date = Column(String)
    content = Column(Text)
    url = Column(String)
    
    board = relationship("Board", back_populates="posts")

def init_db(db_url=None):
    if not db_url:
        db_url = os.getenv('DATABASE_URL', 'sqlite:///learnus.db')
    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)
    engine = create_engine(db_url)
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine)
