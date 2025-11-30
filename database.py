from sqlalchemy import create_engine, Column, Integer, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import declarative_base, relationship, sessionmaker
from datetime import datetime

Base = declarative_base()

class Course(Base):
    __tablename__ = 'courses'
    
    id = Column(Integer, primary_key=True)  # Moodle Course ID
    name = Column(String)
    last_updated = Column(DateTime, default=datetime.now)
    is_active = Column(Boolean, default=True)
    
    assignments = relationship("Assignment", back_populates="course")
    vods = relationship("VOD", back_populates="course")
    files = relationship("FileResource", back_populates="course")
    boards = relationship("Board", back_populates="course")

class Assignment(Base):
    __tablename__ = 'assignments'
    
    id = Column(Integer, primary_key=True) # Module ID
    course_id = Column(Integer, ForeignKey('courses.id'))
    title = Column(String)
    due_date = Column(String) # Storing as string for now as it's free text
    is_completed = Column(Boolean, default=False)
    url = Column(String)
    
    course = relationship("Course", back_populates="assignments")

class VOD(Base):
    __tablename__ = 'vods'
    
    id = Column(Integer, primary_key=True) # Module ID
    course_id = Column(Integer, ForeignKey('courses.id'))
    title = Column(String)
    start_date = Column(String) # Storing as string for simplicity initially
    end_date = Column(String)
    is_completed = Column(Boolean, default=False)
    has_tracking = Column(Boolean, default=True)
    url = Column(String)
    
    course = relationship("Course", back_populates="vods")

class FileResource(Base):
    __tablename__ = 'files'
    id = Column(Integer, primary_key=True) # Board ID
    course_id = Column(Integer, ForeignKey('courses.id'))
    title = Column(String)
    url = Column(String)
    
    is_completed = Column(Boolean, default=False)
    local_path = Column(String, nullable=True)
    
    course = relationship("Course", back_populates="files")

class Board(Base):
    __tablename__ = 'boards'
    
    id = Column(Integer, primary_key=True) # Board ID
    course_id = Column(Integer, ForeignKey('courses.id'))
    title = Column(String)
    url = Column(String)
    
    course = relationship("Course", back_populates="boards")
    posts = relationship("Post", back_populates="board")

class Post(Base):
    __tablename__ = 'posts'
    
    id = Column(Integer, primary_key=True, autoincrement=True) # Internal ID, or we can try to use bwid if unique
    # Note: bwid might not be unique across boards, so let's use autoincrement ID and store bwid separately if needed.
    # Actually, let's store the URL which is unique.
    
    board_id = Column(Integer, ForeignKey('boards.id'))
    title = Column(String)
    writer = Column(String)
    date = Column(String)
    content = Column(Text)
    url = Column(String, unique=True)
    
    board = relationship("Board", back_populates="posts")

def init_db(db_name='learnus.db'):
    engine = create_engine(f'sqlite:///{db_name}')
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine)
