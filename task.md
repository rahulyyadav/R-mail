# Processity.ai Hiring Task — AI-Powered Mail Web Application

## Overview

The task is to build a **mail web application** with an integrated **AI assistant that can control the user interface programmatically**.

The assistant should not behave like a normal chatbot. Instead, it must be able to:

* Compose emails
* Navigate between views
* Display filtered results
* Interact with the interface on behalf of the user

When the user gives instructions in natural language, the assistant should **visibly manipulate the UI**, such as filling forms, switching screens, and executing actions.

Duration: **5 calendar days**
Difficulty: **Intermediate – Advanced**

---

## What to Build

### 1. Mail Client

Create a functional email client connected to a **real mail provider** such as:

* Google (Gmail API)
* Microsoft
* Any other provider of your choice

The client must include the following views:

#### Inbox

* List of received emails
* Show:

  * Sender
  * Subject
  * Preview
  * Date
* Clicking an email opens the full content

#### Sent

* List of sent emails
* Clicking opens the full content

#### Compose

* Ability to write and send an email
* Minimum fields:

  * To
  * Subject
  * Body

#### Email Detail

* Display full email content

---

### 2. Real-Time Mail Sync

New emails must appear in the inbox **without manual refresh**.

You can use any mechanism appropriate for your stack:

* Push notifications
* Pub/Sub
* Webhooks
* Subscriptions
* Other approaches

---

### 3. AI Assistant — Core Requirement

The application must include an **assistant panel** (sidebar, popup, or embedded UI).

This assistant must be able to **control the UI through natural language commands**.

This is the **primary evaluation area**.

---

## Assistant Capabilities

### Compose & Send

Example user instruction:

> Send an email to [john@example.com](mailto:john@example.com) with subject "Meeting Tomorrow" and body "Let’s meet at 3pm"

Expected behavior:

* Compose view opens
* Fields fill visibly
* User clicks Send or assistant sends

---

### Search & Display

Examples:

> Show me emails from the last 10 days
> Find the email from Sarah about the project update

Expected behavior:

* Assistant queries emails using correct filters
* Main UI updates with results (not just chat response)

---

### Navigate & Open

Example:

> Open the latest email from David

Expected behavior:

* Assistant navigates to that email
* Email detail view is displayed

---

### Context Awareness

Example:

> Reply to this

When the user is reading an email:

* Assistant understands which email is open
* Prefills a reply

---

### Filters via Assistant

Example:

> Show only unread emails from this week

Expected behavior:

* Inbox filters accordingly

---

### 4. Filters

Implement basic filtering by:

* Date range
* Sender
* Keyword
* Read / unread status

Filters must work through:

* UI controls (dropdowns, date pickers, etc.)
* Assistant commands (natural language)

---

## What They Are Evaluating

| # | Criteria                                                    | Weight | Priority |
| - | ----------------------------------------------------------- | ------ | -------- |
| 1 | Mail integration works — send and receive real emails       | 20%    | High     |
| 2 | Inbox and Sent views display real data                      | 15%    | High     |
| 3 | Compose and send works via UI                               | 10%    | Medium   |
| 4 | Assistant can compose/fill email form via natural language  | 20%    | Critical |
| 5 | Assistant can search/filter and update main UI              | 15%    | Critical |
| 6 | Assistant is context-aware (current view, open email, etc.) | 10%    | High     |
| 7 | Real-time mail sync (no manual refresh)                     | 10%    | Medium   |

---

## Bonus Features

| Feature                                               | Points |
| ----------------------------------------------------- | ------ |
| Reply / forward via assistant                         | +5     |
| Assistant asks for confirmation before sending        | +5     |
| Rich UI rendering in assistant panel (email previews) | +5     |
| Thread / conversation view                            | +3     |
| Polished UI / dark mode                               | +2     |
| Tests                                                 | +3     |
| Deployed live demo                                    | +2     |

---

## Tech Stack

You can use **any frameworks, libraries, or languages** you prefer.

References (optional):

* CopilotKit
* Google Gmail API
* Microsoft Graph Mail API

---

## Deliverables

### 1. GitHub Repository (Private)

* Invite collaborators:

  * giri-mt
  * adarsh-processity
* Clean commit history
* Working README with setup instructions

---

### 2. README Must Include

* How to set up and run locally
* Architecture decisions and trade-offs
* Screenshots or video demo showing assistant controlling UI
* What you would improve with more time

---

## Submission

Submit within **5 calendar days** of receiving the task.

---

## What They Are Really Looking For

1. **AI controls the UI**

   When a user says “send email”, the compose form should visibly fill.
   When they say “show last week emails”, the inbox updates.

   The assistant acts like a **co-pilot driving the interface**.

2. **Clean Architecture**

   Clear separation between:

   * Mail service
   * UI
   * AI integration

3. **API Integration**

   Ability to connect to external services (OAuth, mail APIs, push notifications).

4. **Pragmatic Engineering**

   * Smart trade-offs
   * Clear documentation
   * Sensible error handling
   * Not over-engineered

---

Source: Processity.ai Hiring Task Document 
