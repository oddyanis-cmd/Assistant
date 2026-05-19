import json
from datetime import datetime
from typing import Optional

from database.db import SessionLocal
from database.models import Task


def _parse_dt(dt_str: str) -> datetime:
    for fmt in ("%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%Y-%m-%d"):
        try:
            return datetime.strptime(dt_str, fmt)
        except ValueError:
            continue
    raise ValueError(f"Cannot parse datetime: {dt_str}. Use ISO format, e.g. 2025-12-31T09:00:00")


def create_task(title: str, due_datetime: str, description: Optional[str] = None, priority: str = "medium") -> str:
    """
    Create a task or reminder. Returns the created task with its ID.
    due_datetime: ISO format, e.g. '2025-12-31T09:00:00'
    priority: low | medium | high
    """
    try:
        due = _parse_dt(due_datetime)
        db = SessionLocal()
        try:
            task = Task(
                title=title,
                description=description,
                due_datetime=due,
                priority=priority,
            )
            db.add(task)
            db.commit()
            db.refresh(task)
            return json.dumps({
                "success": True,
                "task": {
                    "id": task.id,
                    "title": task.title,
                    "description": task.description,
                    "due_datetime": task.due_datetime.isoformat(),
                    "priority": task.priority,
                },
            })
        finally:
            db.close()
    except Exception as e:
        return json.dumps({"error": str(e)})


def list_tasks(filter: str = "upcoming") -> str:
    """
    List tasks.
    filter: all | today | upcoming | overdue | completed
    """
    try:
        now = datetime.utcnow()
        db = SessionLocal()
        try:
            q = db.query(Task)
            if filter == "today":
                q = q.filter(
                    Task.due_datetime >= now.replace(hour=0, minute=0, second=0),
                    Task.due_datetime < now.replace(hour=23, minute=59, second=59),
                    Task.completed == False,
                )
            elif filter == "upcoming":
                q = q.filter(Task.due_datetime >= now, Task.completed == False)
            elif filter == "overdue":
                q = q.filter(Task.due_datetime < now, Task.completed == False)
            elif filter == "completed":
                q = q.filter(Task.completed == True)
            # "all" returns everything

            tasks = q.order_by(Task.due_datetime).all()
            result = [
                {
                    "id": t.id,
                    "title": t.title,
                    "description": t.description,
                    "due_datetime": t.due_datetime.isoformat(),
                    "priority": t.priority,
                    "completed": t.completed,
                }
                for t in tasks
            ]
            return json.dumps({"tasks": result, "count": len(result), "filter": filter})
        finally:
            db.close()
    except Exception as e:
        return json.dumps({"error": str(e)})


def complete_task(task_id: int) -> str:
    """Mark a task as completed by its ID."""
    try:
        db = SessionLocal()
        try:
            task = db.query(Task).filter_by(id=task_id).first()
            if not task:
                return json.dumps({"error": f"Task {task_id} not found."})
            task.completed = True
            db.commit()
            return json.dumps({"success": True, "task_id": task_id, "title": task.title})
        finally:
            db.close()
    except Exception as e:
        return json.dumps({"error": str(e)})


def update_task(task_id: int, title: Optional[str] = None, due_datetime: Optional[str] = None,
                description: Optional[str] = None, priority: Optional[str] = None) -> str:
    """Update an existing task's fields."""
    try:
        db = SessionLocal()
        try:
            task = db.query(Task).filter_by(id=task_id).first()
            if not task:
                return json.dumps({"error": f"Task {task_id} not found."})
            if title:
                task.title = title
            if description is not None:
                task.description = description
            if priority:
                task.priority = priority
            if due_datetime:
                task.due_datetime = _parse_dt(due_datetime)
                task.reminded = False  # reset reminder so the new time is honoured
            db.commit()
            return json.dumps({
                "success": True,
                "task": {
                    "id": task.id,
                    "title": task.title,
                    "due_datetime": task.due_datetime.isoformat(),
                    "priority": task.priority,
                },
            })
        finally:
            db.close()
    except Exception as e:
        return json.dumps({"error": str(e)})


def delete_task(task_id: int) -> str:
    """Permanently delete a task."""
    try:
        db = SessionLocal()
        try:
            task = db.query(Task).filter_by(id=task_id).first()
            if not task:
                return json.dumps({"error": f"Task {task_id} not found."})
            title = task.title
            db.delete(task)
            db.commit()
            return json.dumps({"success": True, "deleted_task_id": task_id, "title": title})
        finally:
            db.close()
    except Exception as e:
        return json.dumps({"error": str(e)})
