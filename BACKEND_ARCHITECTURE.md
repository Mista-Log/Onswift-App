# OnSwift Backend Architecture & Requirements Document

**Version:** 1.0
**Last Updated:** December 11, 2025
**Platform:** Creator-Talent Marketplace & Project Management System

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [System Overview](#system-overview)
3. [Core Data Models](#core-data-models)
4. [API Endpoints Specification](#api-endpoints-specification)
5. [Authentication & Authorization](#authentication--authorization)
6. [File Storage Architecture](#file-storage-architecture)
7. [Real-Time Features (WebSocket)](#real-time-features-websocket)
8. [Database Schema & Relationships](#database-schema--relationships)
9. [Security Requirements](#security-requirements)
10. [Implementation Roadmap](#implementation-roadmap)

---

## Executive Summary

**OnSwift** is a two-sided creative marketplace platform connecting:
- **Creators** (production studios, brands) who hire and manage talent
- **Talent/Freelancers** (designers, video editors, etc.) who work on projects

### Key Features
- User authentication (Creator/Talent roles)
- Project & task management with team collaboration
- Deliverable submission & approval workflows (max 3 revisions)
- Real-time messaging between creators and talent
- Talent marketplace with search & filtering
- Public talent profiles with reviews & ratings
- Calendar with deadline tracking
- File upload/download for deliverables and project samples

### Tech Stack Requirements
- **Backend Framework:** Node.js (Express/Fastify) or Python (Django/FastAPI)
- **Database:** PostgreSQL or MySQL
- **File Storage:** AWS S3 or compatible object storage
- **Real-Time:** WebSocket (Socket.io or similar)
- **Authentication:** JWT tokens with refresh token rotation
- **Caching:** Redis (optional, for performance)

---

## System Overview

### User Roles

**Creator:**
- Creates and manages projects
- Hires talent (builds team)
- Assigns tasks to team members
- Approves/rejects deliverables
- Requests revisions (up to 3 per deliverable)
- Browses talent marketplace
- Messages team members

**Talent:**
- Maintains public profile (bio, skills, portfolio, hourly rate)
- Gets assigned to projects by creators
- Works on assigned tasks
- Submits deliverables with file uploads
- Receives feedback and revision requests
- Messages creators
- Receives reviews from creators

---

## Core Data Models

### 1. User Entity

```typescript
User {
  // Primary fields
  id: UUID (primary key)
  email: string (unique, indexed)
  password: string (bcrypt hashed)
  name: string
  userType: enum('creator', 'talent')

  // Profile picture
  avatarUrl?: string

  // Creator-specific
  companyName?: string

  // Talent-specific
  professionalTitle?: string
  bio?: string (max 500 chars)
  skills?: string[] (max 10, from predefined list)
  portfolioLinks?: string[] (max 5 URLs)
  hourlyRate?: decimal (range: 5.00 - 500.00)
  availability?: enum('available_now', 'available_1_2_weeks', 'available_2_4_weeks', 'not_available')

  // Social links
  linkedinUrl?: string
  twitterUrl?: string
  instagramUrl?: string
  youtubeUrl?: string
  githubUrl?: string

  // Metadata
  createdAt: timestamp
  updatedAt: timestamp
  deletedAt?: timestamp (soft delete)

  // Profile completion
  profileCompletionPercentage?: integer (0-100)
}
```

**Indexes:**
- `email` (unique)
- `userType`
- `createdAt`

**Validation Rules:**
- Email: RFC 5322 compliant
- Password: Min 8 chars, must contain uppercase, number, special character
- Skills: Max 10 items
- Bio: Max 500 characters
- Portfolio links: Max 5 URLs, must be valid URLs
- Hourly rate: 5.00 - 500.00 range

---

### 2. Project Entity

```typescript
Project {
  id: UUID (primary key)
  creatorId: UUID (foreign key -> User.id)
  name: string (max 255 chars)
  description: text
  status: enum('planning', 'in-progress', 'completed')
  dueDate: date

  // Computed fields (can be calculated)
  taskCount?: integer
  completedTaskCount?: integer

  // Metadata
  createdAt: timestamp
  updatedAt: timestamp
  completedAt?: timestamp
  deletedAt?: timestamp (soft delete)
}
```

**Indexes:**
- `creatorId`
- `status`
- `dueDate`

**Validation Rules:**
- Name: Required, max 255 chars
- Description: Required
- Status: Must be one of enum values
- Due date: Must be future date on creation

---

### 3. ProjectTeam Entity (Junction Table)

```typescript
ProjectTeam {
  id: UUID (primary key)
  projectId: UUID (foreign key -> Project.id)
  userId: UUID (foreign key -> User.id, must be talent)
  role?: string (optional, e.g., "Video Editor", "Designer")

  // Metadata
  joinedAt: timestamp
  removedAt?: timestamp
}
```

**Indexes:**
- `projectId, userId` (composite unique)
- `userId`

---

### 4. Task Entity

```typescript
Task {
  id: UUID (primary key)
  projectId: UUID (foreign key -> Project.id)
  name: string (max 255 chars)
  description: text
  status: enum('planning', 'in-progress', 'completed')
  assigneeId: UUID (foreign key -> User.id, must be talent)
  dueDate: date

  // Metadata
  createdAt: timestamp
  updatedAt: timestamp
  completedAt?: timestamp
}
```

**Indexes:**
- `projectId`
- `assigneeId`
- `status`
- `dueDate`

**Validation Rules:**
- Name: Required, max 255 chars
- Status: Must be one of enum values
- AssigneeId: Must reference a talent user
- Due date: Must be valid date

---

### 5. Deliverable Entity

```typescript
Deliverable {
  id: UUID (primary key)
  projectId: UUID (foreign key -> Project.id)
  taskId: UUID (foreign key -> Task.id)
  submittedById: UUID (foreign key -> User.id, must be talent)

  // Submission content
  title: string (max 255 chars)
  description: text (supports @mentions)

  // Status & approval
  status: enum('pending', 'approved', 'revision')
  revisionCount: integer (default: 0, max: 3)
  feedback?: text (from creator when requesting revision)

  // Approval tracking
  approvedAt?: timestamp
  approvedById?: UUID (foreign key -> User.id, must be creator)

  // Metadata
  submittedAt: timestamp (default: now)
  updatedAt: timestamp
}
```

**Indexes:**
- `projectId`
- `taskId`
- `submittedById`
- `status`

**Validation Rules:**
- Title: Required, max 255 chars
- Revision count: Max 3
- Status transitions: pending -> approved OR pending -> revision -> pending (cycle max 3 times)

---

### 6. DeliverableFile Entity

```typescript
DeliverableFile {
  id: UUID (primary key)
  deliverableId: UUID (foreign key -> Deliverable.id)

  // File details
  fileName: string
  fileUrl: string (S3 or storage path)
  fileSize: bigint (bytes)
  mimeType: string

  // Metadata
  uploadedAt: timestamp
}
```

**Indexes:**
- `deliverableId`

**Validation Rules:**
- File size: Max 100MB for videos, 50MB for documents, 5MB for images
- MIME type: Validate against allowed types
- File extension: Must match MIME type

---

### 7. ProjectSample Entity

```typescript
ProjectSample {
  id: UUID (primary key)
  projectId: UUID (foreign key -> Project.id)
  name: string (max 255 chars)
  type: enum('file', 'link')
  url?: string (S3 path for file, or external URL for link)
  description?: text

  // Metadata
  createdAt: timestamp
}
```

**Indexes:**
- `projectId`

**Validation Rules:**
- If type='link', URL must be valid external URL
- If type='file', URL must be valid storage path

---

### 8. Message Entity

```typescript
Message {
  id: UUID (primary key)
  conversationId: UUID (foreign key -> Conversation.id)
  senderId: UUID (foreign key -> User.id)
  content: text

  // Metadata
  sentAt: timestamp (default: now)
  isEdited: boolean (default: false)
  editedAt?: timestamp
  deletedAt?: timestamp (soft delete)
}
```

**Indexes:**
- `conversationId, sentAt` (composite)
- `senderId`

---

### 9. Conversation Entity

```typescript
Conversation {
  id: UUID (primary key)

  // Participants (creator <-> talent, 1-to-1 conversations)
  creatorId: UUID (foreign key -> User.id)
  talentId: UUID (foreign key -> User.id)

  // Last message tracking
  lastMessageAt?: timestamp

  // Metadata
  createdAt: timestamp
}
```

**Indexes:**
- `creatorId, talentId` (composite unique)
- `creatorId`
- `talentId`
- `lastMessageAt`

---

### 10. ConversationRead Entity (Track read status per user)

```typescript
ConversationRead {
  id: UUID (primary key)
  conversationId: UUID (foreign key -> Conversation.id)
  userId: UUID (foreign key -> User.id)
  lastReadMessageId?: UUID (foreign key -> Message.id)
  lastReadAt?: timestamp
}
```

**Indexes:**
- `conversationId, userId` (composite unique)

---

### 11. Review Entity

```typescript
Review {
  id: UUID (primary key)
  talentId: UUID (foreign key -> User.id, must be talent)
  creatorId: UUID (foreign key -> User.id, must be creator)
  projectId?: UUID (foreign key -> Project.id, optional context)

  // Review content
  rating: integer (1-5)
  text: text

  // Metadata
  createdAt: timestamp
  updatedAt: timestamp
  deletedAt?: timestamp (soft delete)
}
```

**Indexes:**
- `talentId`
- `creatorId`
- `rating`

**Validation Rules:**
- Rating: Must be integer 1-5
- One review per creator per talent per project (unique constraint)

---

### 12. Notification Entity

```typescript
Notification {
  id: UUID (primary key)
  userId: UUID (foreign key -> User.id)
  type: enum('task_assigned', 'deliverable_submitted', 'deliverable_approved',
             'revision_requested', 'message_received', 'review_received',
             'deadline_approaching', 'project_status_changed')

  // Notification content
  title: string
  message: text

  // Related entity references
  entityType?: enum('project', 'task', 'deliverable', 'message')
  entityId?: UUID

  // Status
  isRead: boolean (default: false)
  readAt?: timestamp

  // Metadata
  createdAt: timestamp
}
```

**Indexes:**
- `userId, isRead`
- `userId, createdAt`

---

## API Endpoints Specification

### Authentication Endpoints

#### POST /api/auth/signup
**Description:** Register a new user (creator or talent)

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "name": "John Doe",
  "userType": "creator" | "talent",
  "companyName": "Acme Inc" // creator only
}
```

**Response (201):**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "userType": "creator"
  },
  "accessToken": "jwt-token",
  "refreshToken": "refresh-token"
}
```

**Errors:**
- 400: Validation error (email exists, weak password)
- 500: Server error

---

#### POST /api/auth/login
**Description:** Login with email and password

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

**Response (200):**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "userType": "creator"
  },
  "accessToken": "jwt-token",
  "refreshToken": "refresh-token"
}
```

**Errors:**
- 401: Invalid credentials
- 429: Rate limit exceeded (max 5 attempts per 15 min)

---

#### POST /api/auth/refresh
**Description:** Refresh access token using refresh token

**Request Body:**
```json
{
  "refreshToken": "refresh-token"
}
```

**Response (200):**
```json
{
  "accessToken": "new-jwt-token",
  "refreshToken": "new-refresh-token"
}
```

**Errors:**
- 401: Invalid or expired refresh token

---

#### POST /api/auth/logout
**Description:** Invalidate refresh token

**Headers:** `Authorization: Bearer {accessToken}`

**Response (204):** No content

---

#### POST /api/auth/forgot-password
**Description:** Send password reset email

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

**Response (200):**
```json
{
  "message": "Password reset email sent"
}
```

---

#### POST /api/auth/reset-password
**Description:** Reset password with token from email

**Request Body:**
```json
{
  "token": "reset-token",
  "newPassword": "NewSecurePass123!"
}
```

**Response (200):**
```json
{
  "message": "Password reset successful"
}
```

**Errors:**
- 400: Invalid or expired token
- 400: Password validation failed

---

### User Endpoints

#### GET /api/users/me
**Description:** Get current user profile

**Headers:** `Authorization: Bearer {accessToken}`

**Response (200):**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "name": "John Doe",
  "userType": "talent",
  "avatarUrl": "https://storage.../avatar.jpg",
  "professionalTitle": "Senior Video Editor",
  "bio": "10 years of experience...",
  "skills": ["Video Editing", "Motion Graphics"],
  "portfolioLinks": ["https://portfolio.com"],
  "hourlyRate": 75.00,
  "availability": "available_now",
  "linkedinUrl": "https://linkedin.com/in/johndoe",
  "profileCompletionPercentage": 85,
  "createdAt": "2025-01-15T10:00:00Z",
  "updatedAt": "2025-01-20T14:30:00Z"
}
```

---

#### PUT /api/users/me
**Description:** Update current user profile

**Headers:** `Authorization: Bearer {accessToken}`

**Request Body:**
```json
{
  "name": "John Doe",
  "bio": "Updated bio...",
  "skills": ["Video Editing", "Color Grading"],
  "portfolioLinks": ["https://portfolio.com", "https://vimeo.com/user"],
  "hourlyRate": 80.00,
  "availability": "available_now",
  "linkedinUrl": "https://linkedin.com/in/johndoe"
}
```

**Response (200):**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "name": "John Doe",
  "userType": "talent",
  // ... updated fields
  "updatedAt": "2025-01-21T09:00:00Z"
}
```

**Errors:**
- 400: Validation error (invalid URL, skills limit exceeded)

---

#### POST /api/users/me/avatar
**Description:** Upload profile picture

**Headers:**
- `Authorization: Bearer {accessToken}`
- `Content-Type: multipart/form-data`

**Request Body:**
- `avatar`: File (image, max 5MB)

**Response (200):**
```json
{
  "avatarUrl": "https://storage.../avatars/uuid/avatar.jpg"
}
```

**Errors:**
- 400: Invalid file type or size exceeded
- 500: Upload failed

---

#### GET /api/users/:userId
**Description:** Get public user profile (talent only)

**Headers:** `Authorization: Bearer {accessToken}`

**Response (200):**
```json
{
  "id": "uuid",
  "name": "Jane Smith",
  "userType": "talent",
  "avatarUrl": "https://storage.../avatar.jpg",
  "professionalTitle": "UI/UX Designer",
  "bio": "Specializing in mobile app design...",
  "skills": ["UI Design", "Figma", "Prototyping"],
  "portfolioLinks": ["https://dribbble.com/janesmith"],
  "hourlyRate": 65.00,
  "availability": "available_1_2_weeks",
  "linkedinUrl": "https://linkedin.com/in/janesmith",
  "averageRating": 4.8,
  "totalReviews": 15,
  "createdAt": "2024-06-10T08:00:00Z"
}
```

**Errors:**
- 404: User not found
- 403: Cannot view creator profiles (only talent)

---

#### GET /api/users/search
**Description:** Search talent users (creator only)

**Headers:** `Authorization: Bearer {accessToken}`

**Query Parameters:**
- `q`: string (search query, searches name, title, bio)
- `skills[]`: string[] (filter by skills)
- `minRate`: number (min hourly rate)
- `maxRate`: number (max hourly rate)
- `availability`: enum (filter by availability)
- `minRating`: number (1-5)
- `page`: integer (default: 1)
- `limit`: integer (default: 20, max: 50)

**Response (200):**
```json
{
  "users": [
    {
      "id": "uuid",
      "name": "Jane Smith",
      "professionalTitle": "UI/UX Designer",
      "avatarUrl": "https://storage.../avatar.jpg",
      "skills": ["UI Design", "Figma"],
      "hourlyRate": 65.00,
      "availability": "available_now",
      "averageRating": 4.8,
      "totalReviews": 15
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "totalPages": 3
  }
}
```

**Errors:**
- 403: Only creators can search talent

---

### Project Endpoints

#### GET /api/projects
**Description:** Get user's projects (creator: owned projects, talent: assigned projects)

**Headers:** `Authorization: Bearer {accessToken}`

**Query Parameters:**
- `status`: enum (filter by status)
- `page`: integer (default: 1)
- `limit`: integer (default: 20)

**Response (200):**
```json
{
  "projects": [
    {
      "id": "uuid",
      "name": "Brand Collab - Future Funk",
      "description": "Music video production...",
      "status": "in-progress",
      "dueDate": "2025-10-24",
      "taskCount": 4,
      "completedTaskCount": 1,
      "teamMembers": [
        {
          "id": "uuid",
          "name": "Alia Vance",
          "avatarUrl": "https://...",
          "role": "Manager"
        }
      ],
      "createdAt": "2025-10-01T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 8,
    "totalPages": 1
  }
}
```

---

#### POST /api/projects
**Description:** Create new project (creator only)

**Headers:** `Authorization: Bearer {accessToken}`

**Request Body:**
```json
{
  "name": "New Project",
  "description": "Project description",
  "dueDate": "2025-12-31"
}
```

**Response (201):**
```json
{
  "id": "uuid",
  "creatorId": "uuid",
  "name": "New Project",
  "description": "Project description",
  "status": "planning",
  "dueDate": "2025-12-31",
  "taskCount": 0,
  "completedTaskCount": 0,
  "teamMembers": [],
  "createdAt": "2025-01-21T10:00:00Z"
}
```

**Errors:**
- 403: Only creators can create projects
- 400: Validation error

---

#### GET /api/projects/:projectId
**Description:** Get project details

**Headers:** `Authorization: Bearer {accessToken}`

**Response (200):**
```json
{
  "id": "uuid",
  "creatorId": "uuid",
  "name": "Brand Collab - Future Funk",
  "description": "Music video production...",
  "status": "in-progress",
  "dueDate": "2025-10-24",
  "taskCount": 4,
  "completedTaskCount": 1,
  "teamMembers": [
    {
      "id": "uuid",
      "name": "Alia Vance",
      "avatarUrl": "https://...",
      "role": "Manager",
      "joinedAt": "2025-10-01T10:00:00Z"
    }
  ],
  "createdAt": "2025-10-01T10:00:00Z",
  "updatedAt": "2025-10-15T14:00:00Z"
}
```

**Errors:**
- 404: Project not found
- 403: Not authorized (not creator or team member)

---

#### PUT /api/projects/:projectId
**Description:** Update project (creator only)

**Headers:** `Authorization: Bearer {accessToken}`

**Request Body:**
```json
{
  "name": "Updated Project Name",
  "description": "Updated description",
  "status": "in-progress",
  "dueDate": "2025-12-31"
}
```

**Response (200):**
```json
{
  "id": "uuid",
  "name": "Updated Project Name",
  // ... updated fields
  "updatedAt": "2025-01-21T11:00:00Z"
}
```

**Errors:**
- 403: Only project creator can update
- 400: Validation error

---

#### DELETE /api/projects/:projectId
**Description:** Delete project (soft delete, creator only)

**Headers:** `Authorization: Bearer {accessToken}`

**Response (204):** No content

**Errors:**
- 403: Only project creator can delete
- 404: Project not found

---

#### POST /api/projects/:projectId/team
**Description:** Add team member to project (creator only)

**Headers:** `Authorization: Bearer {accessToken}`

**Request Body:**
```json
{
  "userId": "uuid",
  "role": "Video Editor"
}
```

**Response (201):**
```json
{
  "id": "uuid",
  "projectId": "uuid",
  "userId": "uuid",
  "role": "Video Editor",
  "joinedAt": "2025-01-21T12:00:00Z"
}
```

**Errors:**
- 403: Only project creator can add team members
- 400: User already in team
- 400: User must be talent

---

#### DELETE /api/projects/:projectId/team/:userId
**Description:** Remove team member from project (creator only)

**Headers:** `Authorization: Bearer {accessToken}`

**Response (204):** No content

**Errors:**
- 403: Only project creator can remove team members
- 404: User not in project team

---

### Task Endpoints

#### GET /api/projects/:projectId/tasks
**Description:** Get all tasks for a project

**Headers:** `Authorization: Bearer {accessToken}`

**Query Parameters:**
- `status`: enum (filter by status)
- `assigneeId`: UUID (filter by assignee)

**Response (200):**
```json
{
  "tasks": [
    {
      "id": "uuid",
      "projectId": "uuid",
      "name": "Create storyboard",
      "description": "Design initial storyboard...",
      "status": "completed",
      "assignee": {
        "id": "uuid",
        "name": "Alia Vance",
        "avatarUrl": "https://..."
      },
      "dueDate": "2025-10-15",
      "createdAt": "2025-10-01T10:00:00Z",
      "completedAt": "2025-10-14T16:00:00Z"
    }
  ]
}
```

**Errors:**
- 403: Not authorized to view project tasks

---

#### POST /api/projects/:projectId/tasks
**Description:** Create task in project (creator only)

**Headers:** `Authorization: Bearer {accessToken}`

**Request Body:**
```json
{
  "name": "New Task",
  "description": "Task description",
  "assigneeId": "uuid",
  "dueDate": "2025-12-31"
}
```

**Response (201):**
```json
{
  "id": "uuid",
  "projectId": "uuid",
  "name": "New Task",
  "description": "Task description",
  "status": "planning",
  "assignee": {
    "id": "uuid",
    "name": "John Doe",
    "avatarUrl": "https://..."
  },
  "dueDate": "2025-12-31",
  "createdAt": "2025-01-21T13:00:00Z"
}
```

**Errors:**
- 403: Only project creator can create tasks
- 400: Assignee must be in project team

---

#### GET /api/projects/:projectId/tasks/:taskId
**Description:** Get task details

**Headers:** `Authorization: Bearer {accessToken}`

**Response (200):**
```json
{
  "id": "uuid",
  "projectId": "uuid",
  "projectName": "Brand Collab - Future Funk",
  "name": "Create storyboard",
  "description": "Design initial storyboard...",
  "status": "completed",
  "assignee": {
    "id": "uuid",
    "name": "Alia Vance",
    "avatarUrl": "https://..."
  },
  "dueDate": "2025-10-15",
  "createdAt": "2025-10-01T10:00:00Z",
  "updatedAt": "2025-10-14T16:00:00Z",
  "completedAt": "2025-10-14T16:00:00Z"
}
```

**Errors:**
- 404: Task not found
- 403: Not authorized

---

#### PUT /api/projects/:projectId/tasks/:taskId
**Description:** Update task (creator can update all fields, assignee can update status only)

**Headers:** `Authorization: Bearer {accessToken}`

**Request Body (Creator):**
```json
{
  "name": "Updated Task",
  "description": "Updated description",
  "status": "in-progress",
  "assigneeId": "uuid",
  "dueDate": "2025-12-31"
}
```

**Request Body (Assignee - status only):**
```json
{
  "status": "in-progress"
}
```

**Response (200):**
```json
{
  "id": "uuid",
  // ... updated fields
  "updatedAt": "2025-01-21T14:00:00Z"
}
```

**Errors:**
- 403: Not authorized (talent can only update their own tasks' status)
- 400: Validation error

---

#### DELETE /api/projects/:projectId/tasks/:taskId
**Description:** Delete task (creator only)

**Headers:** `Authorization: Bearer {accessToken}`

**Response (204):** No content

**Errors:**
- 403: Only project creator can delete tasks
- 404: Task not found

---

### Deliverable Endpoints

#### GET /api/deliverables
**Description:** Get deliverables (creator: all for their projects, talent: own submissions)

**Headers:** `Authorization: Bearer {accessToken}`

**Query Parameters:**
- `status`: enum (filter by status)
- `projectId`: UUID (filter by project)
- `page`: integer (default: 1)
- `limit`: integer (default: 20)

**Response (200):**
```json
{
  "deliverables": [
    {
      "id": "uuid",
      "projectId": "uuid",
      "projectName": "Brand Collab",
      "taskId": "uuid",
      "taskName": "Design mockups",
      "title": "Final Logo Design",
      "description": "Here's the final logo...",
      "status": "pending",
      "revisionCount": 0,
      "submittedBy": {
        "id": "uuid",
        "name": "Jane Smith",
        "avatarUrl": "https://..."
      },
      "files": [
        {
          "id": "uuid",
          "fileName": "logo_final.png",
          "fileUrl": "https://storage.../logo_final.png",
          "fileSize": 2048576,
          "mimeType": "image/png"
        }
      ],
      "submittedAt": "2025-01-20T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 12,
    "totalPages": 1
  }
}
```

---

#### POST /api/deliverables
**Description:** Submit deliverable (talent only)

**Headers:**
- `Authorization: Bearer {accessToken}`
- `Content-Type: multipart/form-data`

**Request Body:**
- `projectId`: UUID
- `taskId`: UUID
- `title`: string
- `description`: text
- `files[]`: File[] (multiple files)

**Response (201):**
```json
{
  "id": "uuid",
  "projectId": "uuid",
  "taskId": "uuid",
  "title": "Final Logo Design",
  "description": "Here's the final logo...",
  "status": "pending",
  "revisionCount": 0,
  "submittedBy": {
    "id": "uuid",
    "name": "Jane Smith",
    "avatarUrl": "https://..."
  },
  "files": [
    {
      "id": "uuid",
      "fileName": "logo_final.png",
      "fileUrl": "https://storage.../logo_final.png",
      "fileSize": 2048576,
      "mimeType": "image/png"
    }
  ],
  "submittedAt": "2025-01-21T15:00:00Z"
}
```

**Errors:**
- 403: Only talent can submit deliverables
- 400: Validation error (missing files, task not assigned to user)
- 413: File size exceeded

---

#### GET /api/deliverables/:deliverableId
**Description:** Get deliverable details

**Headers:** `Authorization: Bearer {accessToken}`

**Response (200):**
```json
{
  "id": "uuid",
  "projectId": "uuid",
  "projectName": "Brand Collab",
  "taskId": "uuid",
  "taskName": "Design mockups",
  "title": "Final Logo Design",
  "description": "Here's the final logo...",
  "status": "revision",
  "revisionCount": 1,
  "feedback": "Looks good! Can we try a warmer color palette?",
  "submittedBy": {
    "id": "uuid",
    "name": "Jane Smith",
    "avatarUrl": "https://..."
  },
  "approvedBy": null,
  "files": [
    {
      "id": "uuid",
      "fileName": "logo_final.png",
      "fileUrl": "https://storage.../logo_final.png",
      "fileSize": 2048576,
      "mimeType": "image/png"
    }
  ],
  "submittedAt": "2025-01-20T10:00:00Z",
  "updatedAt": "2025-01-21T09:00:00Z"
}
```

**Errors:**
- 404: Deliverable not found
- 403: Not authorized

---

#### PUT /api/deliverables/:deliverableId
**Description:** Update deliverable status (creator only: approve/request revision)

**Headers:** `Authorization: Bearer {accessToken}`

**Request Body (Approve):**
```json
{
  "action": "approve"
}
```

**Request Body (Request Revision):**
```json
{
  "action": "request_revision",
  "feedback": "Please make the following changes..."
}
```

**Response (200):**
```json
{
  "id": "uuid",
  "status": "approved", // or "revision"
  "feedback": null, // or feedback text
  "approvedAt": "2025-01-21T16:00:00Z",
  "approvedBy": {
    "id": "uuid",
    "name": "Creator Name"
  },
  "updatedAt": "2025-01-21T16:00:00Z"
}
```

**Errors:**
- 403: Only project creator can approve/request revision
- 400: Max revision count reached (3)
- 400: Invalid action

---

#### DELETE /api/deliverables/:deliverableId
**Description:** Delete deliverable (submitter or project creator only)

**Headers:** `Authorization: Bearer {accessToken}`

**Response (204):** No content

**Errors:**
- 403: Not authorized
- 404: Deliverable not found

---

### Project Sample Endpoints

#### GET /api/projects/:projectId/samples
**Description:** Get all samples for a project

**Headers:** `Authorization: Bearer {accessToken}`

**Response (200):**
```json
{
  "samples": [
    {
      "id": "uuid",
      "projectId": "uuid",
      "name": "Reference Design 1",
      "type": "link",
      "url": "https://example.com/ref1",
      "description": "Similar style to what we want",
      "createdAt": "2025-01-15T10:00:00Z"
    },
    {
      "id": "uuid",
      "projectId": "uuid",
      "name": "Brand Guidelines.pdf",
      "type": "file",
      "url": "https://storage.../guidelines.pdf",
      "description": "Our brand colors and fonts",
      "createdAt": "2025-01-15T10:05:00Z"
    }
  ]
}
```

**Errors:**
- 403: Not authorized to view project samples

---

#### POST /api/projects/:projectId/samples
**Description:** Add sample to project (creator only)

**Headers:**
- `Authorization: Bearer {accessToken}`
- `Content-Type: multipart/form-data` (for file) or `application/json` (for link)

**Request Body (Link):**
```json
{
  "name": "Reference Design",
  "type": "link",
  "url": "https://example.com/ref",
  "description": "Inspiration source"
}
```

**Request Body (File):**
- `name`: string
- `type`: "file"
- `file`: File
- `description`: string (optional)

**Response (201):**
```json
{
  "id": "uuid",
  "projectId": "uuid",
  "name": "Reference Design",
  "type": "link",
  "url": "https://example.com/ref",
  "description": "Inspiration source",
  "createdAt": "2025-01-21T17:00:00Z"
}
```

**Errors:**
- 403: Only project creator can add samples
- 400: Validation error (invalid URL, missing file)

---

#### DELETE /api/projects/:projectId/samples/:sampleId
**Description:** Delete project sample (creator only)

**Headers:** `Authorization: Bearer {accessToken}`

**Response (204):** No content

**Errors:**
- 403: Only project creator can delete samples
- 404: Sample not found

---

### Message Endpoints

#### GET /api/conversations
**Description:** Get user's conversations

**Headers:** `Authorization: Bearer {accessToken}`

**Query Parameters:**
- `page`: integer (default: 1)
- `limit`: integer (default: 20)

**Response (200):**
```json
{
  "conversations": [
    {
      "id": "uuid",
      "creator": {
        "id": "uuid",
        "name": "Creator Name",
        "avatarUrl": "https://..."
      },
      "talent": {
        "id": "uuid",
        "name": "Talent Name",
        "avatarUrl": "https://..."
      },
      "lastMessage": {
        "id": "uuid",
        "content": "Sounds good!",
        "senderId": "uuid",
        "sentAt": "2025-01-21T10:00:00Z"
      },
      "unreadCount": 2,
      "lastMessageAt": "2025-01-21T10:00:00Z",
      "createdAt": "2025-01-10T08:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 5,
    "totalPages": 1
  }
}
```

---

#### GET /api/conversations/:conversationId/messages
**Description:** Get messages in conversation

**Headers:** `Authorization: Bearer {accessToken}`

**Query Parameters:**
- `before`: UUID (get messages before this message ID, for pagination)
- `limit`: integer (default: 50)

**Response (200):**
```json
{
  "messages": [
    {
      "id": "uuid",
      "conversationId": "uuid",
      "sender": {
        "id": "uuid",
        "name": "Jane Smith",
        "avatarUrl": "https://..."
      },
      "content": "Hey! How's the project going?",
      "sentAt": "2025-01-21T10:30:00Z",
      "isEdited": false
    }
  ],
  "hasMore": false
}
```

**Errors:**
- 403: Not a participant in conversation

---

#### POST /api/conversations/:conversationId/messages
**Description:** Send message in conversation

**Headers:** `Authorization: Bearer {accessToken}`

**Request Body:**
```json
{
  "content": "Great! I just finished the initial concepts."
}
```

**Response (201):**
```json
{
  "id": "uuid",
  "conversationId": "uuid",
  "sender": {
    "id": "uuid",
    "name": "Jane Smith",
    "avatarUrl": "https://..."
  },
  "content": "Great! I just finished the initial concepts.",
  "sentAt": "2025-01-21T10:32:00Z",
  "isEdited": false
}
```

**Errors:**
- 403: Not a participant in conversation
- 400: Empty message

---

#### POST /api/conversations
**Description:** Create or get existing conversation (between creator and talent)

**Headers:** `Authorization: Bearer {accessToken}`

**Request Body:**
```json
{
  "participantId": "uuid" // the other user's ID
}
```

**Response (200 or 201):**
```json
{
  "id": "uuid",
  "creator": {
    "id": "uuid",
    "name": "Creator Name",
    "avatarUrl": "https://..."
  },
  "talent": {
    "id": "uuid",
    "name": "Talent Name",
    "avatarUrl": "https://..."
  },
  "lastMessageAt": null,
  "createdAt": "2025-01-21T18:00:00Z"
}
```

**Errors:**
- 400: Cannot create conversation with same user type (creator to creator)

---

#### PUT /api/conversations/:conversationId/read
**Description:** Mark conversation as read (updates last read message)

**Headers:** `Authorization: Bearer {accessToken}`

**Request Body:**
```json
{
  "messageId": "uuid" // last read message ID
}
```

**Response (204):** No content

---

### Review Endpoints

#### GET /api/users/:userId/reviews
**Description:** Get reviews for a talent user

**Query Parameters:**
- `page`: integer (default: 1)
- `limit`: integer (default: 20)

**Response (200):**
```json
{
  "averageRating": 4.8,
  "totalReviews": 15,
  "reviewDistribution": {
    "5": 10,
    "4": 3,
    "3": 1,
    "2": 1,
    "1": 0
  },
  "reviews": [
    {
      "id": "uuid",
      "creator": {
        "id": "uuid",
        "name": "Creator Name",
        "avatarUrl": "https://..."
      },
      "rating": 5,
      "text": "Excellent work! Delivered on time and exceeded expectations.",
      "createdAt": "2025-01-15T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 15,
    "totalPages": 1
  }
}
```

---

#### POST /api/reviews
**Description:** Create review for talent (creator only, requires completed project together)

**Headers:** `Authorization: Bearer {accessToken}`

**Request Body:**
```json
{
  "talentId": "uuid",
  "projectId": "uuid",
  "rating": 5,
  "text": "Excellent work! Delivered on time..."
}
```

**Response (201):**
```json
{
  "id": "uuid",
  "talentId": "uuid",
  "creator": {
    "id": "uuid",
    "name": "Creator Name",
    "avatarUrl": "https://..."
  },
  "projectId": "uuid",
  "rating": 5,
  "text": "Excellent work! Delivered on time...",
  "createdAt": "2025-01-21T19:00:00Z"
}
```

**Errors:**
- 403: Only creators can leave reviews
- 400: Already reviewed this talent for this project
- 400: No completed project with this talent
- 400: Rating must be 1-5

---

#### PUT /api/reviews/:reviewId
**Description:** Update own review

**Headers:** `Authorization: Bearer {accessToken}`

**Request Body:**
```json
{
  "rating": 4,
  "text": "Updated review text..."
}
```

**Response (200):**
```json
{
  "id": "uuid",
  "rating": 4,
  "text": "Updated review text...",
  "updatedAt": "2025-01-21T20:00:00Z"
}
```

**Errors:**
- 403: Can only update own reviews

---

#### DELETE /api/reviews/:reviewId
**Description:** Delete own review (soft delete)

**Headers:** `Authorization: Bearer {accessToken}`

**Response (204):** No content

**Errors:**
- 403: Can only delete own reviews

---

### Notification Endpoints

#### GET /api/notifications
**Description:** Get user's notifications

**Headers:** `Authorization: Bearer {accessToken}`

**Query Parameters:**
- `isRead`: boolean (filter by read status)
- `page`: integer (default: 1)
- `limit`: integer (default: 20)

**Response (200):**
```json
{
  "notifications": [
    {
      "id": "uuid",
      "type": "task_assigned",
      "title": "New Task Assigned",
      "message": "You've been assigned to 'Create storyboard' in Brand Collab project",
      "entityType": "task",
      "entityId": "uuid",
      "isRead": false,
      "createdAt": "2025-01-21T10:00:00Z"
    }
  ],
  "unreadCount": 5,
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 25,
    "totalPages": 2
  }
}
```

---

#### PUT /api/notifications/:notificationId/read
**Description:** Mark notification as read

**Headers:** `Authorization: Bearer {accessToken}`

**Response (204):** No content

---

#### PUT /api/notifications/read-all
**Description:** Mark all notifications as read

**Headers:** `Authorization: Bearer {accessToken}`

**Response (204):** No content

---

## Authentication & Authorization

### JWT Token Structure

**Access Token (Short-lived, 15 minutes):**
```json
{
  "userId": "uuid",
  "email": "user@example.com",
  "userType": "creator" | "talent",
  "iat": 1234567890,
  "exp": 1234568790
}
```

**Refresh Token (Long-lived, 30 days):**
```json
{
  "userId": "uuid",
  "tokenId": "uuid", // for revocation
  "iat": 1234567890,
  "exp": 1237159890
}
```

### Authorization Matrix

| Endpoint | Creator | Talent | Notes |
|----------|---------|--------|-------|
| POST /projects | ✅ | ❌ | Only creators own projects |
| POST /deliverables | ❌ | ✅ | Only talent submits work |
| PUT /deliverables/:id (approve) | ✅ | ❌ | Only creator approves |
| PUT /tasks/:id (status only) | ❌ | ✅ | Talent can update own task status |
| PUT /tasks/:id (full update) | ✅ | ❌ | Only creator can reassign/change deadline |
| GET /users/search | ✅ | ❌ | Only creators search talent |
| POST /reviews | ✅ | ❌ | Only creators review talent |
| POST /projects/:id/samples | ✅ | ❌ | Only creator adds references |

### Role-Based Access Rules

**Creator Permissions:**
- Create/edit/delete own projects
- Add/remove team members from own projects
- Create/assign/edit tasks in own projects
- Approve/reject deliverables in own projects
- Request revisions (max 3) on deliverables
- Search and browse talent marketplace
- Leave reviews for talent (after project completion)
- Add/remove project samples
- Message talent users

**Talent Permissions:**
- View assigned projects and tasks
- Update status of own assigned tasks
- Submit deliverables for assigned tasks
- Resubmit after revision requests
- View/edit own public profile
- Message creator users
- View reviews received

**Shared Permissions:**
- View own profile
- Update own profile information
- Upload own avatar
- View messages in own conversations
- View own notifications
- View calendar with own deadlines

---

## File Storage Architecture

### Storage Strategy

**Recommended: AWS S3 or Compatible Object Storage**

**Bucket Structure:**
```
onswift-storage/
├── avatars/
│   └── {userId}/
│       └── avatar.{ext}
├── deliverables/
│   └── {projectId}/
│       └── {taskId}/
│           └── {deliverableId}/
│               └── {filename}
├── project-samples/
│   └── {projectId}/
│       └── samples/
│           └── {sampleId}/
│               └── {filename}
└── message-attachments/
    └── {conversationId}/
        └── {messageId}/
            └── {filename}
```

### File Upload Flow

1. **Client requests signed upload URL**
   - POST `/api/upload/presigned-url`
   - Body: `{ "fileName": "logo.png", "fileSize": 2048576, "mimeType": "image/png", "uploadType": "deliverable" }`
   - Response: `{ "uploadUrl": "https://s3.../presigned-url", "fileUrl": "https://s3.../final-url" }`

2. **Client uploads file directly to S3** using presigned URL
   - PUT to presigned URL with file binary

3. **Client confirms upload to backend**
   - Include `fileUrl` in deliverable submission or profile update

### File Download Flow

1. **Generate signed download URL** (for private files)
   - GET `/api/files/:fileId/download-url`
   - Response: `{ "downloadUrl": "https://s3.../presigned-download-url", "expiresIn": 3600 }`

2. **Client downloads file** from signed URL

### File Validation

**Server-Side Checks:**
- Validate MIME type against whitelist
- Validate file extension matches MIME type
- Check file size limits
- Scan for malware (using ClamAV or similar)
- Validate image dimensions (for avatars)

**File Type Whitelist:**
```typescript
const ALLOWED_MIME_TYPES = {
  avatars: ['image/jpeg', 'image/png', 'image/gif'],
  deliverables: [
    'image/jpeg', 'image/png', 'image/gif',
    'video/mp4', 'video/quicktime',
    'application/pdf',
    'application/zip', 'application/x-rar-compressed'
  ],
  samples: [
    'image/jpeg', 'image/png', 'image/gif',
    'application/pdf',
    'video/mp4'
  ]
}
```

**File Size Limits:**
- Avatars: 5 MB
- Images (deliverables): 50 MB
- Videos: 100 MB
- Documents: 50 MB
- Archives: 50 MB

---

## Real-Time Features (WebSocket)

### WebSocket Connection

**Connection URL:** `wss://api.onswift.com/ws`

**Authentication:**
```typescript
// Client connects with JWT token
const socket = io('wss://api.onswift.com', {
  auth: {
    token: 'jwt-access-token'
  }
});
```

### Event Types

#### Client -> Server Events

**1. Join User Room**
```typescript
socket.emit('join:user', { userId: 'uuid' });
```

**2. Join Conversation Room**
```typescript
socket.emit('join:conversation', { conversationId: 'uuid' });
```

**3. Typing Indicator**
```typescript
socket.emit('conversation:typing', {
  conversationId: 'uuid',
  isTyping: true
});
```

**4. Send Message (Real-time)**
```typescript
socket.emit('message:send', {
  conversationId: 'uuid',
  content: 'Hello!'
});
```

**5. Mark as Read**
```typescript
socket.emit('conversation:read', {
  conversationId: 'uuid',
  messageId: 'uuid'
});
```

---

#### Server -> Client Events

**1. New Message**
```typescript
socket.on('message:received', (data) => {
  // data: { message: Message, conversationId: 'uuid' }
});
```

**2. Typing Indicator**
```typescript
socket.on('conversation:typing', (data) => {
  // data: { conversationId: 'uuid', userId: 'uuid', isTyping: true }
});
```

**3. Task Status Changed**
```typescript
socket.on('task:status_changed', (data) => {
  // data: { taskId: 'uuid', status: 'completed', updatedBy: User }
});
```

**4. Deliverable Submitted**
```typescript
socket.on('deliverable:submitted', (data) => {
  // data: { deliverable: Deliverable, projectId: 'uuid' }
});
```

**5. Deliverable Approved**
```typescript
socket.on('deliverable:approved', (data) => {
  // data: { deliverableId: 'uuid', approvedBy: User }
});
```

**6. Revision Requested**
```typescript
socket.on('deliverable:revision_requested', (data) => {
  // data: { deliverableId: 'uuid', feedback: string, requestedBy: User }
});
```

**7. Task Assigned**
```typescript
socket.on('task:assigned', (data) => {
  // data: { task: Task, assignedBy: User }
});
```

**8. Notification**
```typescript
socket.on('notification:new', (data) => {
  // data: { notification: Notification }
});
```

**9. User Online/Offline**
```typescript
socket.on('user:online', (data) => {
  // data: { userId: 'uuid' }
});

socket.on('user:offline', (data) => {
  // data: { userId: 'uuid' }
});
```

---

### Room Management

**User Rooms:**
- Each user joins their own room: `user:{userId}`
- Receive personal notifications, task assignments, etc.

**Conversation Rooms:**
- Join conversation room: `conversation:{conversationId}`
- Receive messages, typing indicators, read receipts

**Project Rooms (Optional):**
- Join project room: `project:{projectId}`
- Receive project-wide updates (status changes, new tasks)

---

### WebSocket Security

- Validate JWT token on connection
- User can only join their own user room
- User can only join conversations they're part of
- Rate limiting on message sending (e.g., 10 messages per minute)
- Disconnect inactive connections after 5 minutes

---

## Database Schema & Relationships

### Entity Relationship Diagram (ERD)

```
┌─────────────────┐
│      User       │
│  (Creator/      │
│   Talent)       │
└────────┬────────┘
         │
         │ 1:N (owns)
         ▼
┌─────────────────┐
│    Project      │
└────────┬────────┘
         │
         │ 1:N
         ▼
┌─────────────────┐       ┌──────────────────┐
│      Task       │◄──────│  ProjectTeam     │
└────────┬────────┘  N:M  │  (junction)      │
         │                └──────────────────┘
         │ 1:N                     △
         ▼                         │
┌─────────────────┐                │
│  Deliverable    │                │ M:N (team members)
└────────┬────────┘                │
         │                         │
         │ 1:N                     │
         ▼                         │
┌─────────────────┐         ┌─────┴──────┐
│ DeliverableFile │         │    User    │
└─────────────────┘         │  (Talent)  │
                            └────────────┘
                                   △
                                   │
                                   │ 1:N (receives)
                                   │
                            ┌──────┴────────┐
                            │    Review     │
                            └───────────────┘
                                   △
                                   │ N:1 (leaves)
                                   │
                            ┌──────┴────────┐
                            │     User      │
                            │   (Creator)   │
                            └───────────────┘

┌─────────────────┐
│  Conversation   │
│  (Creator ↔     │
│   Talent)       │
└────────┬────────┘
         │
         │ 1:N
         ▼
┌─────────────────┐
│    Message      │
└─────────────────┘

┌─────────────────┐
│ ProjectSample   │
│  (references)   │
└─────────────────┘
         △
         │ N:1
         │
┌────────┴────────┐
│    Project      │
└─────────────────┘
```

### Key Relationships

1. **User -> Project** (1:N)
   - A creator owns multiple projects
   - A project belongs to one creator

2. **Project -> Task** (1:N)
   - A project has multiple tasks
   - A task belongs to one project

3. **User -> Task** (1:N as assignee)
   - A talent is assigned to multiple tasks
   - A task is assigned to one talent

4. **Task -> Deliverable** (1:N)
   - A task can have multiple deliverable submissions
   - A deliverable belongs to one task

5. **Deliverable -> DeliverableFile** (1:N)
   - A deliverable can have multiple files
   - A file belongs to one deliverable

6. **User <-> Project** (M:N via ProjectTeam)
   - A talent can be on multiple project teams
   - A project has multiple team members

7. **User -> Review** (1:N as talent)
   - A talent receives multiple reviews
   - A review is for one talent

8. **User -> Review** (1:N as creator)
   - A creator leaves multiple reviews
   - A review is left by one creator

9. **User <-> Conversation** (M:N, but constrained to 2 participants)
   - A user has multiple conversations
   - A conversation has exactly 2 participants (1 creator, 1 talent)

10. **Conversation -> Message** (1:N)
    - A conversation has multiple messages
    - A message belongs to one conversation

11. **Project -> ProjectSample** (1:N)
    - A project has multiple samples/references
    - A sample belongs to one project

### Database Indexes (Summary)

**Critical Indexes:**
- `User.email` (unique)
- `User.userType`
- `Project.creatorId, Project.status`
- `Task.projectId, Task.assigneeId, Task.status`
- `Deliverable.projectId, Deliverable.taskId, Deliverable.status`
- `Message.conversationId, Message.sentAt` (composite for ordering)
- `Conversation.creatorId, Conversation.talentId` (composite unique)
- `Review.talentId`
- `Notification.userId, Notification.isRead, Notification.createdAt`

---

## Security Requirements

### 1. Authentication Security

**Password Requirements:**
- Minimum 8 characters
- Must contain: uppercase letter, lowercase letter, number, special character
- Hash using bcrypt (cost factor: 12)
- Never store plain text passwords

**Token Security:**
- Access tokens: Short-lived (15 minutes)
- Refresh tokens: Long-lived (30 days), stored securely
- Implement token rotation on refresh
- Store refresh tokens in database for revocation
- Blacklist tokens on logout

**Rate Limiting:**
- Login attempts: 5 per 15 minutes per IP
- Password reset: 3 per hour per email
- API calls: 100 per minute per user
- File uploads: 10 per hour per user

---

### 2. Authorization Security

**Principle of Least Privilege:**
- Users can only access resources they own or are assigned to
- Creators cannot impersonate talent and vice versa
- Validate user role on every protected endpoint

**Resource Ownership Checks:**
```typescript
// Example: Check if user can access project
if (project.creatorId !== user.id && !isUserInProjectTeam(user.id, project.id)) {
  throw new UnauthorizedException('Not authorized to access this project');
}
```

---

### 3. Input Validation

**Server-Side Validation (Always):**
- Validate all user inputs against expected types
- Sanitize inputs to prevent XSS
- Use parameterized queries to prevent SQL injection
- Validate email format (RFC 5322)
- Validate URLs before storing
- Limit string lengths (name: 255, bio: 500, etc.)

**File Validation:**
- Validate MIME type and file extension
- Check file size limits
- Scan for malware
- Validate image dimensions for avatars

---

### 4. API Security

**HTTPS Only:**
- All API endpoints must use HTTPS
- Redirect HTTP to HTTPS
- Use valid SSL/TLS certificates

**CORS Configuration:**
- Whitelist allowed origins (frontend domain)
- Allow credentials (cookies)
- Limit allowed methods (GET, POST, PUT, DELETE)

**CSRF Protection:**
- Use CSRF tokens for state-changing operations
- SameSite cookie attribute

**Rate Limiting:**
- Per-endpoint rate limits
- Per-user rate limits
- IP-based rate limits for unauthenticated endpoints

---

### 5. Data Security

**Sensitive Data:**
- Never log passwords or tokens
- Mask sensitive data in logs (emails, IDs)
- Use environment variables for secrets (API keys, database credentials)

**Database Security:**
- Use parameterized queries (prevent SQL injection)
- Encrypt sensitive fields at rest (if applicable)
- Regular backups with encryption
- Soft delete for user data (GDPR compliance)

**File Storage Security:**
- Use presigned URLs with expiration
- Private buckets (not publicly accessible)
- Implement virus scanning on upload
- Validate file ownership before generating download URLs

---

### 6. WebSocket Security

**Connection Security:**
- Authenticate using JWT token
- Validate token on connection and periodically
- Disconnect on invalid token
- Rate limit message sending

**Room Security:**
- Users can only join rooms they're authorized for
- Validate room access on join
- Remove users from rooms when they lose access (e.g., removed from project)

---

## Implementation Roadmap

### Phase 1: Core Infrastructure (Weeks 1-2)

**Week 1: Database & Authentication**
- Set up database (PostgreSQL recommended)
- Create all database tables with relationships
- Implement indexes for performance
- Set up authentication system (JWT)
- Implement signup/login/logout endpoints
- Password hashing (bcrypt)
- Token generation & validation
- Refresh token rotation

**Week 2: User Management**
- User profile CRUD operations
- Avatar upload (S3 integration)
- Profile completion percentage calculation
- Role-based middleware (creator/talent)
- Input validation for all user fields
- Password reset flow (email integration)

**Deliverables:**
- ✅ Functional authentication system
- ✅ User registration for creators and talent
- ✅ Profile management with file uploads
- ✅ Password reset functionality

---

### Phase 2: Project & Task Management (Weeks 3-4)

**Week 3: Projects**
- Project CRUD operations
- Project team management (add/remove members)
- Project samples CRUD (files and links)
- Authorization checks (only creator can edit)
- Project status tracking
- Task count aggregation

**Week 4: Tasks**
- Task CRUD operations
- Task assignment to team members
- Task status updates (planning -> in-progress -> completed)
- Deadline management
- Authorization (creator full access, assignee can update status only)
- Calendar API endpoint (tasks grouped by due date)

**Deliverables:**
- ✅ Full project management system
- ✅ Task assignment and tracking
- ✅ Team member management
- ✅ Project samples/references

---

### Phase 3: Deliverables & Reviews (Weeks 5-6)

**Week 5: Deliverables**
- Deliverable submission (with multiple file uploads)
- File storage integration (S3 presigned URLs)
- Approve/reject workflow
- Revision request system (max 3 revisions)
- Feedback messaging
- Status tracking (pending -> approved/revision)
- File download with signed URLs

**Week 6: Reviews & Ratings**
- Review CRUD operations
- Rating aggregation (average, distribution)
- Review permissions (only creators who worked with talent)
- Display reviews on talent public profiles
- Review editing/deletion

**Deliverables:**
- ✅ Complete deliverable submission & approval workflow
- ✅ File upload/download system
- ✅ Review and rating system
- ✅ Talent public profiles with reviews

---

### Phase 4: Real-Time Features (Weeks 7-8)

**Week 7: Messaging System**
- Conversation CRUD (1-to-1 creator-talent)
- Message sending/receiving
- Message history with pagination
- Unread message tracking
- Mark as read functionality
- WebSocket server setup

**Week 8: WebSocket Integration**
- Real-time message delivery
- Typing indicators
- Online/offline status
- Task update notifications
- Deliverable status notifications
- Notification system (database + real-time)

**Deliverables:**
- ✅ Full messaging system with history
- ✅ Real-time message delivery
- ✅ Real-time notifications
- ✅ Presence tracking

---

### Phase 5: Advanced Features & Polish (Weeks 9-10)

**Week 9: Search & Filtering**
- Talent search API (with filters)
- Advanced filtering (skills, rate, availability, rating)
- Pagination for all list endpoints
- Search optimization (indexes)
- Notification filtering and pagination

**Week 10: Testing, Security & Optimization**
- Comprehensive API testing (unit + integration)
- Security audit (input validation, authorization checks)
- Performance optimization (query optimization, caching)
- Rate limiting implementation
- Error handling standardization
- API documentation (OpenAPI/Swagger)

**Deliverables:**
- ✅ Talent marketplace with search
- ✅ Optimized and secure API
- ✅ Complete API documentation
- ✅ Production-ready system

---

### Post-Launch: Future Enhancements

**Analytics Dashboard:**
- Creator metrics (project completion rate, team performance)
- Talent metrics (task completion rate, average rating)
- Platform statistics

**Advanced Calendar:**
- Calendar sync (Google Calendar, iCal)
- Deadline reminders (email notifications)
- Recurring tasks

**Payment Integration:**
- Payment processing (Stripe/PayPal)
- Invoice generation
- Earnings tracking

**Team Collaboration:**
- Group messaging (project-level)
- File sharing in conversations
- Task comments and mentions

**Mobile App Support:**
- Push notifications (FCM/APNS)
- Mobile-optimized API responses
- Offline support

---

## Technical Stack Recommendations

### Backend Framework

**Option 1: Node.js + Express (Recommended)**
- **Pros:** JavaScript ecosystem, large community, great for real-time (Socket.io)
- **Packages:**
  - `express` - Web framework
  - `jsonwebtoken` - JWT authentication
  - `bcryptjs` - Password hashing
  - `multer` / `multer-s3` - File uploads
  - `socket.io` - WebSockets
  - `pg` / `mysql2` - Database driver
  - `sequelize` / `prisma` - ORM
  - `nodemailer` - Email sending
  - `express-rate-limit` - Rate limiting
  - `helmet` - Security headers
  - `cors` - CORS handling

**Option 2: Python + FastAPI**
- **Pros:** Type safety, async support, automatic API docs
- **Packages:**
  - `fastapi` - Web framework
  - `uvicorn` - ASGI server
  - `sqlalchemy` - ORM
  - `alembic` - Database migrations
  - `python-jose` - JWT
  - `passlib` - Password hashing
  - `boto3` - AWS SDK
  - `python-socketio` - WebSockets
  - `slowapi` - Rate limiting

---

### Database

**PostgreSQL (Recommended)**
- Robust, ACID compliant
- Excellent JSON support
- Advanced indexing
- Full-text search capabilities

**Alternative: MySQL**
- Slightly simpler setup
- Good performance
- Wide hosting support

---

### File Storage

**AWS S3 (Recommended)**
- Scalable, reliable
- Presigned URL support
- Versioning support
- CDN integration (CloudFront)

**Alternatives:**
- Google Cloud Storage
- Azure Blob Storage
- MinIO (self-hosted S3-compatible)

---

### Caching (Optional but Recommended)

**Redis**
- Cache frequently accessed data (user profiles, project lists)
- Session storage for refresh tokens
- Rate limiting counters
- WebSocket room management

---

### Email Service

**SendGrid / AWS SES**
- Password reset emails
- Notification emails
- Transactional emails

---

### Deployment

**Backend Hosting:**
- AWS EC2 / ECS
- Google Cloud Run
- Heroku
- DigitalOcean

**Database Hosting:**
- AWS RDS
- Heroku Postgres
- DigitalOcean Managed Databases

**WebSocket Scaling:**
- Use Redis adapter for Socket.io (multi-server support)
- Load balancer with sticky sessions

---

## API Standards & Best Practices

### RESTful Design

- Use nouns for resources (`/projects`, not `/getProjects`)
- HTTP methods for actions (GET, POST, PUT, DELETE)
- Nested resources for relationships (`/projects/:id/tasks`)
- Query parameters for filtering/pagination (`?status=active&page=2`)

### Response Format

**Success Response:**
```json
{
  "data": { /* resource or array */ },
  "meta": { /* pagination, counts, etc. */ }
}
```

**Error Response:**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      {
        "field": "email",
        "message": "Invalid email format"
      }
    ]
  }
}
```

### HTTP Status Codes

- `200 OK` - Successful GET/PUT
- `201 Created` - Successful POST
- `204 No Content` - Successful DELETE
- `400 Bad Request` - Validation error
- `401 Unauthorized` - Not authenticated
- `403 Forbidden` - Not authorized
- `404 Not Found` - Resource doesn't exist
- `409 Conflict` - Resource conflict (e.g., email exists)
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - Server error

### Pagination

**Request:**
```
GET /api/projects?page=2&limit=20
```

**Response:**
```json
{
  "data": [ /* items */ ],
  "pagination": {
    "page": 2,
    "limit": 20,
    "total": 45,
    "totalPages": 3,
    "hasNext": true,
    "hasPrev": true
  }
}
```

### Filtering & Sorting

**Request:**
```
GET /api/tasks?status=in-progress&assigneeId=uuid&sort=-dueDate
```
- `-` prefix for descending order

---

## Conclusion

This document provides a comprehensive blueprint for building the OnSwift backend. The architecture is designed to be scalable, secure, and maintainable.

**Key Takeaways:**

1. **Two-Sided Platform:** Clear separation between creator and talent roles
2. **Role-Based Access:** Strict authorization checks on all endpoints
3. **Real-Time Communication:** WebSocket integration for messaging and notifications
4. **File Management:** Secure file uploads with S3 and presigned URLs
5. **Scalable Design:** Pagination, caching, and database optimization
6. **Security First:** Input validation, rate limiting, token security

**Next Steps:**

1. Review this document with your team
2. Set up development environment
3. Follow the implementation roadmap
4. Conduct regular code reviews
5. Test thoroughly (unit, integration, security)
6. Deploy to production with monitoring

For questions or clarifications during implementation, refer to the specific sections of this document. Good luck building OnSwift!

---

**Document Version:** 1.0
**Last Updated:** December 11, 2025
**Prepared By:** Claude (AI Assistant)
**For:** OnSwift Development Team
