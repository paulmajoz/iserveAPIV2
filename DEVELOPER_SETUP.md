# iServe — Developer Setup Guide

> **Who is this for?**  
> Anyone who wants to run iServe locally on their own machine for the first time — no prior experience required.

---

## What you are setting up

| Part | What it does |
|------|-------------|
| **iserveAPIV2** | The back-end server (NestJS + MongoDB). Handles all data. |
| **iserveUIV2** | The front-end web app (Angular). What users see in the browser. |

Both need to be running at the same time for the app to work.

---

## Step 1 — Install the required tools

You only need to do this once per computer.

### 1a. Install Node.js

1. Go to **https://nodejs.org**
2. Click the **LTS** (recommended) download button
3. Run the installer — click Next all the way through
4. When it finishes, open **Terminal** (Mac) or **Command Prompt** (Windows) and type:
   ```
   node --version
   ```
   You should see something like `v20.x.x`. If you do, Node is installed ✅

### 1b. Install Git

1. Go to **https://git-scm.com/downloads**
2. Download and run the installer for your operating system
3. Accept all default options during installation
4. Verify it worked by typing in your terminal:
   ```
   git --version
   ```
   You should see something like `git version 2.x.x` ✅

### 1c. Install the Angular CLI

In your terminal, run:
```
npm install -g @angular/cli
```
Wait for it to finish (takes about 1 minute).

---

## Step 2 — Get the code

You need to download both projects. Pick a folder on your computer where you want to keep them (e.g. your Desktop or a `Projects` folder).

Open your terminal, navigate to that folder, then run:

```bash
git clone -b dev https://github.com/paulmajoz/iserveAPIV2.git
git clone -b dev https://github.com/paulmajoz/iserveUIV2.git
```

This creates two folders: `iserveAPIV2` and `iserveUIV2`.

---

## Step 3 — Set up the API (back-end)

### 3a. Install dependencies

```bash
cd iserveAPIV2
npm install
```

Wait for it to finish. You will see a lot of text — that is normal.

### 3b. Create the environment file

The API needs a configuration file with database and security settings. This file is **not** stored in GitHub (it contains secrets).

1. In the `iserveAPIV2` folder, find the file called `.env.example`
2. Make a copy of it and name the copy `.env`  
   - Mac/Linux: `cp .env.example .env`  
   - Windows: `copy .env.example .env`
3. Open `.env` in any text editor (Notepad, VS Code, etc.) and fill in the values:

```
# MongoDB connection string — get this from MongoDB Atlas or your local MongoDB
MONGODB_URI=mongodb+srv://YOUR_USERNAME:YOUR_PASSWORD@cluster.mongodb.net/iserve

# A long random secret used to sign login tokens — make up any long string
JWT_SECRET=some-very-long-random-string-change-this

# The port the API runs on (3000 is fine for local development)
PORT=3000

# The URL of the front-end app (used for CORS)
FRONTEND_URL=http://localhost:4200
```

> **Where do I get a MongoDB URI?**  
> The easiest option is MongoDB Atlas (free tier):  
> 1. Go to https://cloud.mongodb.com and create a free account  
> 2. Create a free cluster  
> 3. Click **Connect → Drivers** and copy the connection string  
> 4. Replace `<password>` with your Atlas password

### 3c. (Optional) Seed the database with sample data

If you want test data to work with from the start:
```bash
npm run seed
```

### 3d. Start the API

```bash
npm run start:dev
```

You should see output ending with:
```
[Nest] Application is running on: http://localhost:3000
```

Leave this terminal window open — the API must keep running. ✅

---

## Step 4 — Set up the UI (front-end)

Open a **second** terminal window (keep the first one running the API).

### 4a. Install dependencies

```bash
cd iserveUIV2
npm install --legacy-peer-deps
```

This may take 2–3 minutes.

### 4b. Start the UI

```bash
ng serve
```

You should see:
```
✔ Compiled successfully.
Local: http://localhost:4200/
```

Leave this terminal window open too. ✅

---

## Step 5 — Open the app

Open your browser and go to:

```
http://localhost:4200
```

To log in as a teacher, add your query parameters to the URL:
```
http://localhost:4200?email=teacher@school.com&role=Staff&schoolId=YOUR_SCHOOL_ID
```

For a student:
```
http://localhost:4200?email=student@school.com&role=Student&schoolId=YOUR_SCHOOL_ID
```

---

## Daily workflow (once everything is installed)

Every time you want to work on iServe:

1. **Terminal 1** — Start the API:
   ```bash
   cd iserveAPIV2
   npm run start:dev
   ```

2. **Terminal 2** — Start the UI:
   ```bash
   cd iserveUIV2
   ng serve
   ```

3. Open **http://localhost:4200** in your browser.

---

## Making and saving changes

We use two branches:

| Branch | Purpose |
|--------|---------|
| `dev` | Active development — push your work here |
| `main` | Stable / production code — only merge here when ready |

### Before you start work each day

Always pull the latest changes first:
```bash
# In iserveAPIV2
git pull origin dev

# In iserveUIV2
git pull origin dev
```

### Saving your work

```bash
git add .
git commit -m "brief description of what you changed"
git push origin dev
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `node: command not found` | Node.js is not installed — go back to Step 1a |
| `ng: command not found` | Angular CLI is not installed — run `npm install -g @angular/cli` |
| `ECONNREFUSED` in the browser | The API is not running — start it in Terminal 1 |
| Port 3000 or 4200 already in use | Another app is using that port. Stop it, or change `PORT=` in `.env` and `ng serve --port 4201` |
| `npm install` fails with peer dependency errors | Use `npm install --legacy-peer-deps` instead |
| Changes not showing in the browser | The Angular dev server auto-reloads. If it doesn't, press `Ctrl+C` then `ng serve` again |
| MongoDB connection error | Check your `MONGODB_URI` in `.env` — make sure the password and cluster name are correct |

---

## Useful links

- **API repo:** https://github.com/paulmajoz/iserveAPIV2
- **UI repo:** https://github.com/paulmajoz/iserveUIV2
- **MongoDB Atlas (free DB):** https://cloud.mongodb.com
- **Node.js download:** https://nodejs.org
- **Git download:** https://git-scm.com/downloads

---

*Last updated: April 2026*
