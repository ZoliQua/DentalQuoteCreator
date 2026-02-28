Production deployment files for fogorvosa.hu
=============================================

FTP server: ftp.fogorvosa.hu
User: dentalmanager@fogorvosa.hu

File mapping:
  public_html.htaccess  ->  public_html/.htaccess
  passenger-backend.htaccess  ->  public_html/backend/.htaccess

IMPORTANT:
- Never use `mirror -R --delete` on public_html! It deletes these .htaccess files.
- The public_html/backend/.htaccess contains Passenger config for the Node.js app.
- Without it, the backend API will not work (404 on all /backend/* endpoints).
- The Node.js app root is at /home/fogorvosa/backend2/ on the server.
- The app serves on URL path /backend (NOT /backend2).
