# EPSU Clearance Management System (CMS)

A full-stack university clearance management system designed to digitize student clearance applications, coordinate approvals across university offices, and provide transparent clearance progress tracking.

**Project status:** Under active development

## Overview

The EPSU Clearance Management System (CMS) is a web-based application designed to streamline the university clearance process. It provides a centralized platform where students can apply for clearance, follow the progress of their requests, and interact with a structured approval workflow.

The system is designed to support university offices in reviewing clearance requirements, recording approval decisions, identifying pending requirements, and coordinating the clearance process through defined dependencies between offices.

The project emphasizes maintainable backend architecture, database-backed workflows, role-based access control, and a responsive web interface.

## Problem Statement

Traditional university clearance processes may involve paper forms, repeated visits to administrative offices, manual record keeping, and limited visibility into application status.

These challenges can result in delays, duplicated work, communication difficulties, and uncertainty about which office must act next.

The CMS addresses these problems by providing a centralized digital workflow for submitting, reviewing, and tracking clearance requests.

## Project Objectives

- Digitize the student clearance application process.
- Centralize clearance requests and approval records.
- Coordinate approvals across university offices.
- Enforce approval prerequisites and workflow dependencies.
- Provide students with visibility into their clearance progress.
- Support administrators in configuring clearance templates, offices, and workflows.
- Maintain structured, persistent records in a relational database.
- Build a modular application that can be extended and maintained over time.

## Core Features

### Student functionality

- Student authentication and access to the dashboard.
- Retrieval of the authenticated student's profile.
- Clearance application form with clearance-type selection.
- Academic-year and semester selection where applicable.
- A reason field for other clearance requests.
- Selection of an available clearance template and its associated workflow.
- Submission of clearance requests.
- Viewing clearance request information and progress, subject to the implemented dashboard features.

### Clearance administration

- Management of clearance units or offices.
- Configuration of clearance templates and their required items.
- Definition of workflows and workflow steps.
- Association of workflows with clearance templates.
- Configuration of approval responsibilities and prerequisites.

### Clearance review and approval

- Office-specific review of clearance items.
- Approval and rejection decisions where supported by the implemented review process.
- Recording of review comments and correction comments.
- Tracking of request and item statuses.
- Enforcement of workflow prerequisites before dependent offices proceed.

### Application integrity

- Server-side validation of application data.
- Authentication and role-based authorization.
- Database-backed persistence of clearance records.
- API error handling and validation of relationships between academic years and semesters.

*The exact availability of each feature will be verified against the current implementation and test results before the project is presented as complete.*

## Clearance Workflow

The configured clearance process follows this intended sequence:

1. **Library** — completes the initial clearance review.
2. **Property** — completes its initial review independently of the other initial offices.
3. **Dormitory** — completes its initial review independently of the other initial offices.
4. **Finance** — proceeds after Library, Property, and Dormitory have all approved.
5. **Department** — proceeds after Finance approves.
6. **College** — proceeds after Department approves.
7. **Registrar** — performs the final approval after the preceding required stages are complete.

The workflow is designed to enforce dependencies in the backend rather than relying exclusively on the frontend to control the order of approvals.

### Workflow transitions

A typical clearance request moves through the following conceptual stages:

`Draft → Submitted → Initial Office Reviews → Finance → Department → College → Registrar → Completed`

The exact stored statuses and permitted transitions depend on the implemented backend rules. Rejections, correction requests, and resubmissions must be documented according to their actual behavior in the application.

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js, React, TypeScript |
| Backend | NestJS, Node.js, TypeScript |
| API communication | HTTP REST API |
| Database | PostgreSQL |
| ORM and database schema | Prisma |
| Package management | pnpm workspaces |
| Authentication | JWT-based authentication |
| Frontend development | Next.js development and production build tooling |
| Version control | Git and GitHub |

The exact package versions and additional libraries will be confirmed from the project's package manifests.

## System Architecture

The application is organized as a pnpm workspace monorepo.

```text
CMS/
├── apps/
│   ├── web/                  # Next.js frontend
│   └── api/                  # NestJS REST API
├── packages/
│   └── database/             # Prisma schema and migrations
├── pnpm-workspace.yaml
├── package.json
└── README.md
```

### Frontend

The Next.js application provides the user interface for authentication, student applications, clearance tracking, and administrative operations.

Responsibilities include:

- Rendering dashboard pages and application forms.
- Managing form state and client-side validation.
- Calling backend API endpoints.
- Displaying request details, status information, and error messages.
- Providing a user interface appropriate to the authenticated user's role.

### Backend

The NestJS API handles application logic and acts as the central authority for clearance operations.

Responsibilities include:

- Authentication and authorization.
- Student and clearance-related operations.
- Validation of incoming requests.
- Clearance template and workflow management.
- Enforcement of approval prerequisites.
- Persistence and retrieval of records through Prisma.
- Consistent handling of API errors.

### Database

PostgreSQL stores the system's persistent data, with Prisma providing the schema, database access layer, and migration tooling.

The database design supports relationships between students, clearance requests, templates, workflow configurations, offices, academic years, semesters, and review records, as represented in the actual schema.

## Clearance Application Data

The application form supports these clearance types:

- **Semester clearance:** requires an academic year and semester.
- **End-of-year clearance:** requires an academic year.
- **Graduation clearance:** selected as a distinct clearance type.
- **Other clearance:** requires a reason supplied by the student.

The backend must validate these requirements and verify that a selected semester belongs to the selected academic year. The frontend provides the corresponding conditional fields, while the API remains responsible for enforcing data integrity.

## API Design

The frontend communicates with the NestJS backend through REST endpoints.

Known clearance-related endpoints include:

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/clearance/templates` | Retrieve clearance templates |
| GET | `/api/clearance/workflows` | Retrieve configured workflows |
| GET | `/api/clearance/academic-years` | Retrieve academic years |
| GET | `/api/clearance/academic-years/:academicYearId/semesters` | Retrieve semesters for an academic year |
| POST | `/api/clearance/requests` | Create a clearance request |
| POST | `/api/clearance/requests/:id/submit` | Submit a clearance request |

The complete endpoint list, request payloads, response structures, and authorization requirements will be documented after reviewing the controllers and DTOs.

## Security Considerations

The system uses JWT-based authentication and role-based authorization. Sensitive operations must be authorized by the backend, not merely hidden in the frontend.

Important security considerations include:

- Validating incoming data on the server.
- Enforcing access restrictions for student and administrative operations.
- Checking workflow prerequisites before accepting approval decisions.
- Keeping database credentials and authentication secrets out of source control.
- Using environment variables for deployment-specific configuration.
- Applying appropriate production settings for authentication, logging, and error handling.

## Local Development Setup

### Prerequisites

Install the required versions of:

- Node.js
- pnpm
- PostgreSQL

A compatible database instance and environment configuration are required before starting the application.

### 1. Clone the repository

```bash
git clone https://github.com/Zolla21/University-Clearance-Management-System.git
cd University-Clearance-Management-System
```

### 2. Install dependencies

```bash
pnpm install
```

### 3. Configure environment variables

Configure the database connection and application settings using the environment files expected by the project.

The web application currently uses the following local API URL:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

Set the database connection string and any required authentication configuration in the appropriate local environment file. Never commit real credentials or secrets.

### 4. Prepare the database

Run the Prisma migration and client-generation commands supported by the repository's database package. The precise commands should be confirmed against the installed Prisma version and package scripts.

### 5. Start the backend

```bash
pnpm --filter api run start:dev
```

The API is configured to use port `3001` in the current local development setup.

### 6. Start the frontend

```bash
pnpm --filter web dev
```

Open the local frontend at `http://localhost:3000`.

### 7. Build and verify

```bash
pnpm --filter api build
pnpm --filter web build
```

A successful build confirms compilation and the checks performed by the build scripts. It does not replace end-to-end testing of authentication, submissions, and approval transitions.

## Testing and Quality Assurance

Verification should cover:

- Successful and unsuccessful authentication.
- Student profile retrieval.
- Clearance form validation for each clearance type.
- Creation and submission of clearance requests.
- Academic-year and semester relationship validation.
- Unauthorized access to protected operations.
- Approval prerequisite enforcement.
- Approval, rejection, correction, and resubmission behavior.
- Frontend and backend production builds.

Only tests actually executed successfully should be reported as passing.

## Current Development Status

The project is under active development.

Current work includes the clearance application form, academic-year and semester selection, clearance workflow configuration, and integration between the Next.js frontend and NestJS API.

Remaining tasks are tracked against the current implementation, including completing and verifying clearance application submission, testing the end-to-end workflow, and finishing the student dashboard experience.

Features that have not been verified or completed should not be presented as production-ready.

## Future Improvements

Potential improvements, subject to project requirements, include:

- A permanent student information panel.
- A complete clearance request history with dates and statuses.
- Detailed office-by-office progress visualization.
- Expanded automated testing and integration tests.
- Improved deployment documentation.
- Production deployment with secure environment configuration.
- Additional reporting and administrative analytics.

## Author

**Zelalem Fissiha**

Portfolio: https://zolla21.github.io/

GitHub: https://github.com/Zolla21

CMS Repository: University Clearance Management System

## License

A license has not yet been specified. Add an appropriate license file before declaring the project open source.
