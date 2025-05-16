# Export Backend – PublishJockey

This is the **export-backend** service for PublishJockey. It provides advanced import/export functionality for book projects, including PDF, EPUB, DOCX, and HTML generation, as well as file/image uploads and markdown processing.

---

## Features

- **Import:**
  - Upload and convert `.md`, `.docx`, `.txt`, or Google Docs files to markdown.
- **Export:**
  - Generate PDF, EPUB, DOCX, and HTML from structured book content using Pandoc and custom LaTeX templates.
- **Image Upload:**
  - Upload and manage images for use in book content.
- **Book Assembly:**
  - Assemble book sections into a single document with correct front, main, and back matter.
- **KDP-Compliant Layout:**
  - Automatic margin, page size, and structure handling for Amazon KDP and other publishers.
- **Debug Tools:**
  - Endpoints for raw project inspection and troubleshooting.

---

## API Endpoints

- `POST /import` – Import a file (markdown, docx, txt)
- `POST /import/google` – Import from Google Docs URL
- `POST /export/pdf` – Export book as PDF
- `POST /export/epub` – Export book as EPUB
- `POST /export/docx` – Export book as DOCX
- `POST /export/html` – Export book as HTML
- `POST /api/uploads` – Upload images for book content
- `GET /api/projects/:id` – Get a single project (for export)
- `PUT /api/projects/:id` – Update a project (content, structure, metadata)
- `GET /health` – Health check

---

## Setup & Usage

### 1. **Install Dependencies**

```bash
cd apps/export-backend
npm install
```

### 2. **Start the Export Backend**

```bash
npm start
```
- The server runs on [http://localhost:3002](http://localhost:3002) by default.

### 3. **Requirements**
- **Node.js** (v16+ recommended)
- **Pandoc** (must be installed and in your PATH)
- **XeLaTeX** (for PDF export)
- **MongoDB** (shared with main backend)

---

## Environment Variables

- `MONGO_URI` – MongoDB connection string (default: `mongodb://localhost:27017/publishjockey`)
- `JWT_SECRET` – JWT secret for authentication
- `USER_SERVICE_URL` – URL for user service (default: `http://localhost:3001`)

Create a `.env` file in `apps/export-backend` to override defaults.

---

## Troubleshooting

- **Import/Export Fails:**
  - Ensure Pandoc and XeLaTeX are installed and accessible.
  - Check that the export-backend is running on port 3002.
  - Review backend logs for detailed error messages.
- **CORS Issues:**
  - The server allows requests from `localhost:3000` and `localhost:5173` by default.
- **Image Upload Issues:**
  - Ensure the `uploads` directory exists and is writable.
- **PDF Margin/Layout Issues:**
  - Review margin and page size settings in the export options and LaTeX templates.

---

## Development Notes

- All import/export logic is handled in `server.js` and supporting modules.
- Book assembly and formatting logic is in `bookAssemblerPdf.js`, `bookAssemblerEpub.js`, and `bookAssemblerDocx.js`.
- Debug endpoints are available for raw project inspection and troubleshooting.

---

## Contact

For support or questions, open an issue or contact the maintainer.

---

## License

MIT 