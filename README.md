# ΛΕΒΙΑΘΑΝ - Cloud Edition

Εφαρμογή διαχείρισης PDF με Google Drive integration.

## Deployment στο Vercel

### Βήμα 1: Ανέβασε τον κώδικα στο GitHub

1. Πήγαινε στο https://github.com/new
2. Δημιούργησε νέο repository: `leviathan-cloud`
3. Ανέβασε τα αρχεία

### Βήμα 2: Σύνδεση με Vercel

1. Πήγαινε στο https://vercel.com
2. Sign up με το GitHub account σου
3. Κλικ "Add New Project"
4. Επέλεξε το `leviathan-cloud` repository
5. Κλικ "Import"

### Βήμα 3: Ρύθμιση Environment Variables

Στην οθόνη deployment, πρόσθεσε τα εξής Environment Variables:

```
GOOGLE_CLIENT_ID = 1049303270382-5mn0dqlohd0u2qj5sdrsati4rvfhh7fv.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET = (θα το αλλάξεις με νέο)
NEXTAUTH_SECRET = (τυχαίο string, π.χ. από https://generate-secret.vercel.app/32)
NEXTAUTH_URL = https://your-app-name.vercel.app (θα το ξέρεις μετά το deploy)
ALLOWED_EMAILS = emitselos@gmail.com,smitselos@gmail.com,palaiapoli@icloud.com
FOLDER_KEIMENA = 1-6Oqam3dZgXe7IM5sUlTbeAKArpGLt8D
FOLDER_BIBLIA = 1-QMCbsF_W05-0MyMnSWDpYl11_Ams_PV
FOLDER_DIKTYA = 1ldTOz7H8j-ZQNBVCwmlt5D3RoPfDod4s
FOLDER_EPEXERGASIA = 19ELtn49cFxT5EJIH0NiM-esY--NCqes3
FOLDER_THEORIA_GLOSSA = 1OjEexfvT6GhneYVD94IhzQw2y6m9cvCo
FOLDER_THEORIA_LOGOTEXNIA = 1-bdnqrSC-e7EwmeXzAhnj4FGRO_xC9Of
FOLDER_LOGOTEXNIA = 1VHVXnv5swxRTM_PzlQftb9D0WX0ePAsK
```

### Βήμα 4: Deploy

Κλικ "Deploy" και περίμενε 1-2 λεπτά.

### Βήμα 5: Ρύθμιση Google OAuth Redirect

1. Πήγαινε στο Google Cloud Console → APIs & Services → Credentials
2. Επέλεξε το OAuth client που έφτιαξες
3. Στο "Authorized redirect URIs" πρόσθεσε:
   ```
   https://your-app-name.vercel.app/api/auth/callback/google
   ```
4. Αποθήκευσε

### Βήμα 6: Ενημέρωση NEXTAUTH_URL

1. Στο Vercel → Project Settings → Environment Variables
2. Ενημέρωσε το `NEXTAUTH_URL` με το πραγματικό URL της εφαρμογής
3. Redeploy

## Τοπική ανάπτυξη

```bash
npm install
npm run dev
```

Άνοιξε http://localhost:3000

## Δομή αρχείων

```
leviathan-cloud/
├── pages/
│   ├── api/
│   │   ├── auth/[...nextauth].js  # OAuth
│   │   └── files/
│   │       ├── [folderId].js      # List files
│   │       └── pdf/[fileId].js    # Serve PDF
│   ├── _app.js
│   ├── index.js                    # Main app
│   └── login.js                    # Login page
├── lib/
│   ├── config.js                   # Folder config
│   └── drive.js                    # Google Drive API
├── public/
│   └── logo.png
├── .env.local                      # Environment variables
├── package.json
└── next.config.js
```
