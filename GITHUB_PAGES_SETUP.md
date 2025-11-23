# GitHub Pages Setup Guide

## Your Repository
**Repository:** `da64w2/artisanbread`

## Step-by-Step Setup

### Step 1: Enable GitHub Pages

1. **Go to your repository** on GitHub: `https://github.com/da64w2/artisanbread`
2. **Click on "Settings"** (top right of the repository page)
3. **Scroll down to "Pages"** in the left sidebar
4. **Under "Source"**, select:
   - **Branch:** `main` (or `master` if that's your default branch)
   - **Folder:** `/ (root)` or `/web` if your files are in a web subfolder
5. **Click "Save"**

### Step 2: Wait for Deployment

- GitHub will build and deploy your site (takes 1-2 minutes)
- You'll see a green checkmark when it's ready
- Your site will be available at: `https://da64w2.github.io/artisanbread/`

### Step 3: Access Your Frontend

**Your frontend URL will be:**
```
https://da64w2.github.io/artisanbread/
```

**Or if your files are in a `/web` folder:**
```
https://da64w2.github.io/artisanbread/web/
```

## Important Notes

### Backend URL Configuration

Your frontend is already configured to automatically detect if it's running on GitHub Pages and use your production backend:

- **Backend URL:** `https://ccs4thyear.com/ArtisanBreads/Backend/public`
- The frontend will automatically connect to this backend when accessed via GitHub Pages

### File Structure

Make sure your repository structure is:
```
artisanbread/
├── index.html
├── login.html
├── register.html
├── css/
│   ├── style.css
│   └── index.css
└── js/
    ├── app.js
    └── admin-script.js
```

**OR** if you have a `/web` folder:
```
artisanbread/
└── web/
    ├── index.html
    ├── login.html
    ├── css/
    └── js/
```

## Custom Domain (Optional)

If you want to use a custom domain (e.g., `artisanbread.ccs4thyear.com`):

1. In GitHub Pages settings, add your custom domain
2. Update DNS records to point to GitHub Pages
3. Update the backend URL detection in `js/app.js` if needed

## Troubleshooting

### 404 Error
- Check that `index.html` is in the root of your selected folder
- Verify the branch and folder settings in GitHub Pages

### CORS Errors
- Your backend CORS is already configured for `ccs4thyear.com`
- If using GitHub Pages URL, you may need to add it to backend CORS settings

### Backend Not Connecting
- Check browser console for errors
- Verify backend URL in `js/app.js`
- Make sure backend is accessible at: `https://ccs4thyear.com/ArtisanBreads/Backend/public/api/test`

## Quick Test

After deployment, test your frontend:
1. Visit: `https://da64w2.github.io/artisanbread/`
2. Try logging in with: `admin` / `admin123`
3. Check browser console (F12) for any errors

---

**Your frontend will be live at:** `https://da64w2.github.io/artisanbread/` 🚀

