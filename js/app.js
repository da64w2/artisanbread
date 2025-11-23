// frontend/app.js

// Always initialize base URL
// Production: https://ccs4thyear.com/ArtisanBreads/Backend/public
// Development: http://127.0.0.1:8000
if (!window.BASE) {
  // Check if we're on localhost (development) or production (GitHub Pages, custom domain, etc.)
  const isLocalhost = window.location.hostname === 'localhost' || 
                      window.location.hostname === '127.0.0.1' ||
                      window.location.hostname.includes('192.168.') ||
                      window.location.hostname.includes('10.0.');
  
  window.BASE = localStorage.getItem('BACKEND_BASE') || 
    (isLocalhost 
      ? 'http://127.0.0.1:8000'
      : 'https://ccs4thyear.com/ArtisanBreads/Backend/public');
}

function setBase(url) {
  if (!url) return;
  // if only a port like "3000" or ":3000" passed, coerce to localhost
  if (/^:?\d+$/.test(String(url))) url = `http://localhost:${String(url).replace(/^:/, '')}/`;
  if (!/^https?:\/\//.test(url)) {
    // allow "localhost:3000" -> "http://localhost:3000/"
    url = 'http://' + url;
  }
  if (!url.endsWith('/')) url += '/';
  window.BASE = url;
  localStorage.setItem('BACKEND_BASE', url);
}

function getBase() {
  return window.BASE;
}

// Make available globally
window.setBase = setBase;
window.getBase = getBase;

// Authentication helpers
function saveToken(token) { 
  if (token) localStorage.setItem('token', token); 
}

function getToken() { 
  return localStorage.getItem('token'); 
}

function clearToken() { 
  localStorage.removeItem('token'); 
}

function isAuthed() { 
  return !!getToken(); 
}

function setAuthUI(isLoggedIn) {
  document.querySelectorAll('.guest-only').forEach(el => {
    el.style.display = isLoggedIn ? 'none' : '';
  });
  document.querySelectorAll('.auth-only').forEach(el => {
    el.style.display = isLoggedIn ? '' : 'none';
  });
}

// Enhanced API function with better error handling using AXIOS
async function api(path, options = {}) {
  const { method = 'GET', data, multipart } = options;
  
  // Configure axios defaults
  const axiosConfig = {
    method: method.toLowerCase(),
    withCredentials: true,
    headers: {}
  };

  const token = getToken();

  if (multipart) {
    // For FormData, let axios handle the content-type with boundary
    axiosConfig.data = data;
    console.log('Multipart request - FormData body:', data);
    console.log('FormData entries in API:', Array.from(data.entries()));
  } else if (data) {
    axiosConfig.data = data;
    axiosConfig.headers['Content-Type'] = 'application/json';
  }

  if (token) {
    axiosConfig.headers['Authorization'] = `Bearer ${token}`;
  }

  // Build endpoint URL
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  let endpoint;

  if (/^https?:\/\//i.test(path)) {
    endpoint = path;
  } else {
    endpoint = new URL(`api${normalizedPath}`, getBase()).toString();
  }

  try {
    console.log('API call to:', endpoint);
    console.log('API config:', axiosConfig);
    
    const response = await axios(endpoint, axiosConfig);
    
    // Axios automatically parses JSON responses
    const responseData = response.data || {};
    
    console.log('API response:', responseData);
    return responseData;
    
  } catch (error) {
    console.error('API error:', error);
    
    // Handle axios error structure
    if (error.response) {
      // Server responded with error status
      const status = error.response.status;
      const responseData = error.response.data || {};
      
      if (status === 401) {
        // Only logout if we have a token and the response indicates invalid token
        if (token && responseData && responseData.message && 
            (responseData.message.includes('Invalid') || responseData.message.includes('expired'))) {
          clearToken();
          setAuthUI(false);
          // Call logout endpoint to handle server-side logout
          try {
            await axios.post(new URL('api/auth/logout', getBase()).toString(), {}, {
              withCredentials: true,
              headers: token ? { 'Authorization': `Bearer ${token}` } : {}
            });
          } catch (e) {
            // Ignore logout errors
          }
          await showAlert('Invalid Token', 'Your session has expired or token is invalid. Please login again.', 'error');
        }
        throw responseData;
      }
      throw responseData;
    } else if (error.request) {
      // Network error
      throw { message: 'Network error. Please check your connection.' };
    } else {
      // Other error
      throw { message: error.message || 'Unknown error occurred' };
    }
  }
}

// Server-verified authentication check
async function requireAuth(redirectTo = 'login.html') {
  if (!isAuthed()) {
    setAuthUI(false);
    location.href = redirectTo;
    return false;
  }
  try {
    const user = await api('/users/me');
    window.currentUser = user; // Set the current user
    setAuthUI(true);
    return true;
  } catch (err) {
    // If not 401 (handled by api), other errors like network
    setAuthUI(false);
    if (!location.pathname.endsWith(redirectTo)) {
      location.href = redirectTo;
    }
    return false;
  }
}

// Check auth status without redirect
function checkAuthStatus() {
  console.log('checkAuthStatus called, isLoggingIn:', window.isLoggingIn);
  
  // Skip auth check if we're in the middle of a login process
  if (window.isLoggingIn) {
    console.log('Skipping auth check - login in progress');
    return;
  }
  
  if (!isAuthed()) {
    console.log('No token found, setting auth UI to false');
    setAuthUI(false);
    return;
  }
  
  console.log('Token found, checking with server...');
  api('/users/me')
    .then(user => {
      console.log('Auth check successful, user:', user.name);
      window.currentUser = user;
      setAuthUI(true);
      document.querySelectorAll('.user-name').forEach(el => {
        try { 
          el.textContent = user.name;
        } catch(e) {
          console.warn('Could not update user name element:', e);
        }
      });
    })
    .catch(err => {
      console.log('Auth check failed:', err.message);
      // Only clear token if it's actually invalid, not just a network error
      if (err && err.message && (err.message.includes('Invalid') || err.message.includes('expired'))) {
        clearToken();
        setAuthUI(false);
      }
    });
}

// Enhanced alert function
const showAlert = (title, text, icon = 'info', options = {}) => {
  return Swal.fire({
    title: title,
    text: text,
    icon: icon,
    confirmButtonText: options.confirmButtonText || 'OK',
    allowOutsideClick: options.allowOutsideClick !== false,
    timer: options.timer || null,
    timerProgressBar: options.timerProgressBar || false,
    ...options
  });
};

// Initialize auth UI
setAuthUI(isAuthed());

// Global logout functionality
const logoutBtn = document.getElementById('btnLogout');
if (logoutBtn) {
  logoutBtn.addEventListener('click', async () => {
    try { 
      await api('/auth/logout', { method: 'POST' }); 
      await showAlert('Logged Out', 'You have successfully logged out.', 'success');
    } catch (err) {
      console.error('Logout error:', err);
      await showAlert('Error', 'Failed to log out properly, but you will be logged out locally.', 'warning');
    }
    clearToken();
    location.href = 'login.html';
  });
}

// Registration form handler
const registerForm = document.getElementById('registerForm');
if (registerForm) {
  console.log('Register form found, attaching event handler');
  registerForm.addEventListener('submit', async (e) => {
    console.log('Form submit event triggered');
    console.log('Event:', e);
    console.log('Current URL:', window.location.href);
    console.log('Form element:', registerForm);
    console.log('Form action:', registerForm.action);
    console.log('Form method:', registerForm.method);
    
    e.preventDefault();
    e.stopPropagation();
    
    // Ensure form doesn't submit normally
    if (e.defaultPrevented) {
      console.log('Default prevented successfully');
    } else {
      console.error('Failed to prevent default form submission');
      return;
    }
    
    console.log('Proceeding with JavaScript form handling...');

    // Frontend password confirmation validation
    const password = registerForm.password?.value || '';
    const confirmPassword = document.getElementById('confirmPassword')?.value || '';

    if (password !== confirmPassword) {
      await showAlert('Error', 'Passwords do not match. Please make sure both passwords are identical.', 'error');
      return;
    }

    if (password.length < 6) {
      await showAlert('Error', 'Password must be at least 6 characters long.', 'error');
      return;
    }

    const formData = new FormData(registerForm);
    const loadingEl = document.getElementById('registerLoading');

    if (loadingEl) loadingEl.textContent = 'Creating account...';

    try {
      console.log('Making API call to /auth/register...');
      const response = await api('/auth/register', {
        method: 'POST',
        data: formData,
        multipart: true
      });
      
      console.log('API call completed successfully:', response);
      console.log('Full response object:', JSON.stringify(response, null, 2));

      // Extract email from response or form data - try multiple ways
      let email = '';
      if (response && response.email) {
        email = response.email;
      } else if (formData.get('email')) {
        email = formData.get('email');
      } else if (document.getElementById('registerEmail')) {
        email = document.getElementById('registerEmail').value;
      }
      
      const message = (response && response.message) || 'Registration successful. Please check your email for verification code.';

      console.log('Extracted email:', email);
      console.log('Message:', message);
      
      // If no email found, this is a problem
      if (!email) {
        console.error('Email not found in response or form data');
        console.error('Response:', response);
        console.error('FormData email:', formData.get('email'));
        await showAlert('Error', 'Registration completed but email not found. Please try logging in manually.', 'warning');
        setTimeout(() => {
          location.href = 'login.html';
        }, 2000);
        return;
      }

      // Reset form and update loading text
      registerForm.reset();
      if (loadingEl) {
        loadingEl.textContent = 'Registration successful!';
        loadingEl.style.display = 'inline';
      }

      // Always redirect to verify-email.html after successful registration
      const redirectUrl = `verify-email.html?email=${encodeURIComponent(email)}`;
      console.log('Preparing redirect to:', redirectUrl);
      
      // Show success alert - use simpler approach
      console.log('Checking Swal availability...');
      if (typeof Swal !== 'undefined' && typeof Swal.fire === 'function') {
        console.log('Swal is available, showing alert...');
        Swal.fire({
          title: 'Registration Successful!',
          text: message,
          icon: 'success',
          confirmButtonText: 'OK',
          allowOutsideClick: false,
          allowEscapeKey: false
        }).then((result) => {
          console.log('Alert closed, redirecting...');
          window.location.href = redirectUrl;
        }).catch((err) => {
          console.error('Alert error:', err);
          // Redirect anyway
          window.location.href = redirectUrl;
        });
      } else {
        console.warn('Swal not available, using alert() and redirecting...');
        alert('Registration Successful!\n\n' + message);
        window.location.href = redirectUrl;
      }

    } catch (err) {
      console.error('Registration error:', err);
      console.error('Error details:', {
        message: err?.message,
        status: err?.status,
        response: err?.response,
        stack: err?.stack
      });

      let errorMessage = 'Registration failed. Please try again.';
      if (err?.message) {
        errorMessage = err.message;
      } else if (err?.errors && Array.isArray(err.errors) && err.errors.length > 0) {
        errorMessage = err.errors[0].msg || errorMessage;
      } else if (typeof err === 'string') {
        errorMessage = err;
      }

      if (loadingEl) loadingEl.textContent = '';
      
      // Show error alert
      if (typeof Swal !== 'undefined' && typeof Swal.fire === 'function') {
        await Swal.fire({
          title: 'Registration Failed',
          text: errorMessage,
          icon: 'error',
          confirmButtonText: 'OK'
        });
      } else {
        alert('Registration Failed\n\n' + errorMessage);
      }
    }
  });
}

// Login form handler
const loginForm = document.getElementById('loginForm');
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Set flag to prevent checkAuthStatus from interfering
    window.isLoggingIn = true;
    
    const loadingEl = document.getElementById('loginLoading');
    if (loadingEl) loadingEl.textContent = 'Logging in...';
    
    const payload = {
      username: loginForm.username.value.trim(),
      password: loginForm.password.value,
    };
    
    try {
      const { token, user } = await api('/auth/login', { method: 'POST', data: payload });
      
      saveToken(token);
      
      // Show verification success modal for verified accounts
      await Swal.fire({
        title: 'Account Verified!',
        text: `Welcome back, ${user.name}! Your account is verified and ready to use.`,
        icon: 'success',
        confirmButtonText: 'Continue',
        confirmButtonColor: '#28a745',
        timer: 3000,
        timerProgressBar: true
      });
      
      if (loadingEl) loadingEl.textContent = `Welcome, ${user.name}!`;
      
      // Set auth UI immediately after successful login
      setAuthUI(true);
      
      // Redirect based on user type
      let redirectUrl = 'index.html';
      if (user.user_type === 'admin') {
        redirectUrl = 'admin.html';
      } else if (user.user_type === 'artisan') {
        redirectUrl = 'artisan.html';
      } else if (user.user_type === 'customer') {
        redirectUrl = 'customer.html';
      }
      
      console.log('Login successful, redirecting to', redirectUrl, 'in 1 second...');
      console.log('Current URL:', window.location.href);
      console.log('Token saved:', !!getToken());
      
      setTimeout(() => {
        console.log('Redirecting to bread.html now...');
        console.log('About to redirect to:', window.location.origin + '/bread.html');
        // Use window.location.replace to prevent back button issues
        window.location.replace('bread.html');
      }, 1000);
      
    } catch (err) {
      console.error('Login error:', err);
      
      const errorMsg = err?.message || '';
      
      if (errorMsg.includes('not verified') || errorMsg.includes('Email not verified') || errorMsg.includes('Please verify your account')) {
        let email = err.email || '';
        
        // Check if backend provided redirect_to field
        if (err.redirect_to) {
          if (loadingEl) loadingEl.textContent = 'Redirecting to verification...';
          setTimeout(() => {
            location.href = `${err.redirect_to}?email=${encodeURIComponent(email)}`;
          }, 1000);
          return;
        }
        
        // Fallback: if no email provided, ask user
        if (!email) {
          const { value: userEmail } = await Swal.fire({
            title: 'Account Verification Required',
            text: 'Please enter your email address to proceed with verification.',
            input: 'email',
            inputPlaceholder: 'Enter your email',
            inputValidator: (value) => {
              if (!value || !value.includes('@')) {
                return 'Please enter a valid email address!';
              }
            },
            showCancelButton: true,
            confirmButtonText: 'Continue',
            cancelButtonText: 'Cancel'
          });
          
          if (userEmail) {
            email = userEmail;
          } else {
            await showAlert('Account Not Verified', 'Please verify your account before logging in.', 'error');
            if (loadingEl) loadingEl.textContent = 'Login cancelled';
            return;
          }
        }
        
        if (loadingEl) loadingEl.textContent = 'Redirecting to verification...';
        setTimeout(() => {
          location.href = `verify-email.html?email=${encodeURIComponent(email)}`;
        }, 1000);
        
      } else {
        const message = errorMsg || 'Login failed. Please check your credentials.';
        await showAlert('Login Failed', message, 'error');
        if (loadingEl) loadingEl.textContent = message;
      }
    } finally {
      // Clear the flag
      window.isLoggingIn = false;
    }
  });
}

// Forgot password form handler
const forgotForm = document.getElementById('forgotForm');
if (forgotForm) {
  forgotForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = (forgotForm.email?.value || '').trim();
    if (!email) {
      await showAlert('Error', 'Please enter your email address.', 'error');
      return;
    }
    
    try {
      const response = await api('/auth/forgot-password', { method: 'POST', data: { email } });
      
      // Check if response includes redirect information
      if (response.redirect_to && response.token && response.email) {
        await Swal.fire({
          title: '✅ Email Sent Successfully!',
          html: `
            <div style="text-align: left;">
              <p><strong>Password reset instructions have been sent to:</strong></p>
              <p style="color: #8B4513; font-weight: bold; margin: 10px 0;">📧 ${response.email}</p>
              <p style="margin-top: 15px;">You will be redirected to the password reset page automatically.</p>
              <p style="font-size: 14px; color: #666; margin-top: 10px;">
                <strong>What's next?</strong><br>
                • Check your email inbox<br>
                • Click the reset link in the email<br>
                • Create your new password
              </p>
            </div>
          `,
          icon: 'success',
          confirmButtonText: 'Go to Reset Page',
          confirmButtonColor: '#8B4513',
          allowOutsideClick: false,
          timer: 5000,
          timerProgressBar: true,
          showCancelButton: true,
          cancelButtonText: 'Stay Here',
          cancelButtonColor: '#6c757d'
        }).then((result) => {
          forgotForm.reset();
          if (result.isConfirmed || result.dismiss === Swal.DismissReason.timer) {
            const redirectUrl = `${response.redirect_to}?token=${response.token}&email=${encodeURIComponent(response.email)}`;
            window.location.href = redirectUrl;
          }
        });
      } else {
        // Fallback to original behavior
        await Swal.fire({
          title: '✅ Email Sent Successfully!',
          html: `
            <div style="text-align: left;">
              <p><strong>Password reset instructions have been sent to:</strong></p>
              <p style="color: #8B4513; font-weight: bold; margin: 10px 0;">📧 ${email}</p>
              <p style="margin-top: 15px;">Please check your email and follow the instructions to reset your password.</p>
              <p style="font-size: 14px; color: #666; margin-top: 10px;">
                <strong>What's next?</strong><br>
                • Check your email inbox<br>
                • Look for the password reset email<br>
                • Click the link in the email to reset your password
              </p>
            </div>
          `,
          icon: 'success',
          confirmButtonText: 'Go to Login',
          confirmButtonColor: '#8B4513',
          allowOutsideClick: false,
          timer: 4000,
          timerProgressBar: true
        }).then(() => {
          forgotForm.reset();
          window.location.href = 'login.html';
        });
      }
    } catch (err) {
      console.error('Forgot password error:', err);
      
      // Determine error message and type
      let errorTitle = '❌ Request Failed';
      let errorMessage = 'Failed to send reset email. Please try again.';
      let errorDetails = '';
      
      if (err.status === 404) {
        errorTitle = '❌ Email Not Found';
        errorMessage = 'No account found with this email address.';
        errorDetails = 'Please check your email address or create a new account.';
      } else if (err.status === 429) {
        errorTitle = '⏰ Too Many Requests';
        errorMessage = 'You have requested too many password resets.';
        errorDetails = 'Please wait a few minutes before trying again.';
      } else if (err.status === 0) {
        errorTitle = '🌐 Network Error';
        errorMessage = 'Unable to connect to the server.';
        errorDetails = 'Please check your internet connection and try again.';
      } else if (err.message) {
        errorMessage = err.message;
        if (err.response && err.response.message) {
          errorDetails = err.response.message;
        }
      }
      
      await Swal.fire({
        title: errorTitle,
        html: `
          <div style="text-align: left;">
            <p><strong>${errorMessage}</strong></p>
            ${errorDetails ? `<p style="color: #666; margin-top: 10px;">${errorDetails}</p>` : ''}
            <p style="font-size: 14px; color: #666; margin-top: 15px;">
              <strong>What you can do:</strong><br>
              • Double-check your email address<br>
              • Make sure you have an account with us<br>
              • Try again in a few minutes<br>
              • Contact support if the problem persists
            </p>
          </div>
        `,
        icon: 'error',
        confirmButtonText: 'Try Again',
        confirmButtonColor: '#dc3545',
        allowOutsideClick: false,
        showCancelButton: true,
        cancelButtonText: 'Go to Login',
        cancelButtonColor: '#6c757d'
      }).then((result) => {
        if (result.isDismissed && result.dismiss === Swal.DismissReason.cancel) {
          window.location.href = 'login.html';
        }
        // If confirmed, stay on the page to try again
      });
    }
  });
}

// Reset password form handler
const resetForm = document.getElementById('resetForm');
if (resetForm) {
  resetForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const password = resetForm.password?.value || '';
    const confirmPassword = resetForm.confirm_password?.value || '';
    
    if (!password) {
      await showAlert('Error', 'Please enter a new password.', 'error');
      return;
    }
    
    if (password.length < 6) {
      await showAlert('Error', 'Password must be at least 6 characters long.', 'error');
      return;
    }
    
    if (password !== confirmPassword) {
      await showAlert('Error', 'Passwords do not match.', 'error');
      return;
    }

    const params = new URLSearchParams(location.search);
    const token = params.get('token');
    
    if (!token) {
      await showAlert('Error', 'Invalid reset link. Please request a new password reset.', 'error');
      return;
    }

    const payload = { token, password };

    try {
      const response = await api('/auth/reset-password', { method: 'POST', data: payload });
      
      const message = response?.message || 'Password reset successfully. You can now log in.';
      await showAlert('Success', message, 'success');
      
      resetForm.reset();
      
      setTimeout(() => {
        location.href = 'login.html';
      }, 2000);
      
    } catch (err) {
      console.error('Reset password error:', err);
      const message = err?.message || 'Failed to reset password. Please try again.';
      await showAlert('Reset Failed', message, 'error');
    }
  });
}

// Email verification (if on verify-email page)
// Note: Verification form handler is now handled in verify-email.html to avoid duplicate handlers
const verifyForm = document.getElementById('verifyForm');
if (verifyForm) {
  const params = new URLSearchParams(location.search);
  const emailFromUrl = params.get('email');
  const emailInput = document.getElementById('verifyEmail');
  
  if (emailInput && emailFromUrl) {
    emailInput.value = emailFromUrl;
  }
}

// Resend OTP functionality is now handled in verify-email.html to avoid duplicate handlers

// Profile image management
async function updateProfileImage(imageElement, profilePicPath) {
  if (!imageElement) return;
  
  try {
    // Determine the image path - handle null, undefined, empty string, or 'null' string
    let imagePath = 'uploads/default-profile.png';
    if (profilePicPath && profilePicPath !== 'null' && profilePicPath.trim() !== '') {
      imagePath = profilePicPath;
    }
    
    // Construct the full URL
    const baseUrl = getBase().replace(/\/$/, ''); // Remove trailing slash
    const fullUrl = `${baseUrl}/${imagePath.replace(/^\//, '')}`;
    const fallbackUrl = `${baseUrl}/uploads/default-profile.png`;
    
    console.log('Loading profile image:', fullUrl);
    
    // Add cache-busting parameter to prevent caching issues
    const cacheBuster = `?t=${Date.now()}`;
    const finalUrl = `${fullUrl}${cacheBuster}`;
    
    // Set up error handling
    imageElement.onerror = () => {
      console.warn('Profile image failed to load, using fallback:', fullUrl);
      imageElement.onerror = null; // Prevent infinite loop
      imageElement.src = `${fallbackUrl}${cacheBuster}`;
    };
    
    // Set the image source
    imageElement.src = finalUrl;
    
    // Optional: Add loading state
    imageElement.style.opacity = '0.7';
    imageElement.onload = () => {
      imageElement.style.opacity = '1';
    };
    
  } catch (error) {
    console.error('Error updating profile image:', error);
    // Fallback to default image
    const fallbackUrl = `${getBase().replace(/\/$/, '')}/uploads/default-profile.png?t=${Date.now()}`;
    imageElement.src = fallbackUrl;
  }
}

// Profile management
async function loadProfile() {
  // Stronger protection against multiple calls
  if (window.profileLoading) {
    console.log('Profile already loading, skipping...');
    return;
  }
  
  // Check if profile was already loaded recently (within 5 seconds)
  const now = Date.now();
  if (window.lastProfileLoad && (now - window.lastProfileLoad) < 5000) {
    console.log('Profile loaded recently, skipping... Time since last load:', now - window.lastProfileLoad, 'ms');
    return;
  }
  
  window.profileLoading = true;
  window.lastProfileLoad = now;
  
  try {
    console.log('Loading profile... Stack trace:', new Error().stack);
    const user = await api('/users/me');
    
    // Update form fields if they exist
    const fields = ['editName', 'editUsername', 'editEmail', 'editContact'];
    fields.forEach(fieldId => {
      const element = document.getElementById(fieldId);
      if (element) {
        const fieldMap = {
          'editName': 'name',
          'editUsername': 'username', 
          'editEmail': 'email',
          'editContact': 'contact_number'
        };
        element.value = user[fieldMap[fieldId]] || '';
      }
    });
    
    // Update profile display elements
    const nameEl = document.getElementById('profileName');
    const usernameEl = document.getElementById('profileUsername');
    
    if (nameEl) nameEl.textContent = user.name || 'No Name Set';
    if (usernameEl) usernameEl.textContent = '@' + (user.username || '');

    // Update profile image with improved fetching
    const profileImage = document.getElementById('profileImage');
    if (profileImage) {
      await updateProfileImage(profileImage, user.profilePic);
    }
    
    // Mark profile as loaded
    window.profileLoaded = true;
    console.log('Profile loaded successfully');
    return user;
  } catch (err) {
    console.error('Load profile error:', err);
    
    // Ensure default profile image is shown even if profile loading fails
    const profileImage = document.getElementById('profileImage');
    if (profileImage) {
      await updateProfileImage(profileImage, 'uploads/default-profile.png');
    }
    
    // Don't throw error to prevent cascading failures
    // Just return null to indicate loading failed
    return null;
  } finally {
    // Reset loading flag immediately to prevent delays
    window.profileLoading = false;
    console.log('Profile loading completed');
  }
}

// Set default profile image immediately
function setDefaultProfileImage() {
  const profileImage = document.getElementById('profileImage');
  if (profileImage && !profileImage.src) {
    const defaultUrl = `${getBase().replace(/\/$/, '')}/uploads/default-profile.png?t=${Date.now()}`;
    profileImage.src = defaultUrl;
    console.log('Set default profile image:', defaultUrl);
  }
}


// Profile form handlers
const infoForm = document.getElementById('infoForm');
if (infoForm && !window.profileHandlersInitialized) {
  window.profileHandlersInitialized = true;
  console.log('Initializing profile handlers...');
  setDefaultProfileImage(); // Set default image immediately
  
  // Load profile immediately if not already loaded
  if (!window.profileLoaded && !window.profileLoading) {
    console.log('Loading profile immediately...');
    loadProfile();
  }
  
  infoForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const name = document.getElementById('editName')?.value?.trim();
    const email = document.getElementById('editEmail')?.value?.trim();
    const contactNumber = document.getElementById('editContact')?.value?.trim();

    if (!name) {
      await showAlert('Error', 'Name is required.', 'error');
      return;
    }
    
    if (!email) {
      await showAlert('Error', 'Email is required.', 'error');
      return;
    }

    const payload = { 
      name, 
      email, 
      contact_number: contactNumber 
    };

    try {
      await api('/users/me', { method: 'PUT', data: payload });
      await showAlert('Success', 'Profile updated successfully!', 'success');
      // Don't reload profile to avoid fallback loops - form fields are already updated
    } catch (err) {
      console.error('Update profile error:', err);
      const message = err?.message || 'Failed to update profile';
      await showAlert('Error', message, 'error');
    }
  });
} else {
  // Check if this is a public page that shouldn't load profile
  const publicPages = ['register.html', 'login.html', 'forgot-password.html', 'reset-password.html', 'verify-email.html'];
  const currentPage = window.location.pathname.split('/').pop();
  
  if (publicPages.includes(currentPage)) {
    console.log('Public page detected, skipping profile loading:', currentPage);
    // Only set default image for public pages, don't load profile
    setDefaultProfileImage();
  } else {
    // If no profile form exists, still set default image and load profile (for direct page access)
    console.log('No profile form found, setting default image and loading profile...');
    setDefaultProfileImage();
    
    // Load profile immediately if not already loaded
    if (!window.profileLoaded && !window.profileLoading) {
      console.log('Loading profile immediately (no form case)...');
      loadProfile();
    }
  }
}

const photoForm = document.getElementById('photoForm');
if (photoForm) {
  // Handle file input change for preview
  const fileInput = photoForm.querySelector('input[type="file"]');
  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const profileImage = document.getElementById('profileImage');
          if (profileImage) {
            profileImage.src = e.target.result;
            console.log('Profile image preview updated');
          }
        };
        reader.readAsDataURL(file);
      }
    });
  }

  photoForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const fileInput = photoForm.querySelector('input[type="file"]');
    
    console.log('Photo form submitted');
    console.log('File input:', fileInput);
    console.log('Files:', fileInput?.files);
    
    if (!fileInput?.files?.length) {
      await showAlert('Error', 'Please select a photo to upload.', 'error');
      return;
    }

    // Create FormData manually to ensure proper file handling
    const formData = new FormData();
    const file = fileInput.files[0];
    
    console.log('File details:', {
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified
    });
    
    // Ensure the file is properly appended
    formData.append('avatar', file, file.name);
    
    console.log('FormData entries:');
    for (let [key, value] of formData.entries()) {
      console.log(key, value);
    }
    
    // Additional verification
    console.log('FormData has avatar:', formData.has('avatar'));
    console.log('FormData get avatar:', formData.get('avatar'));
    console.log('FormData size:', formData.get('avatar')?.size);

    try {
      console.log('Making API call to /users/me/photo');
      console.log('FormData:', formData);
      console.log('File:', fileInput.files[0]);
      console.log('File size:', fileInput.files[0].size, 'bytes');
      console.log('File type:', fileInput.files[0].type);
      
      const response = await api('/users/me/photo', { 
        method: 'PUT', 
        data: formData, 
        multipart: true 
      });

      console.log('Avatar upload response:', response);

      // Update profile image immediately with improved fetching
      const profileImage = document.getElementById('profileImage');
      if (profileImage && response.profilePic) {
        console.log('Avatar upload response:', response);
        await updateProfileImage(profileImage, response.profilePic);
      }

      // Don't reload profile to avoid fallback loops
      // Profile is already loaded and image is updated above

      await showAlert('Success', 'Profile photo updated successfully!', 'success');
      photoForm.reset();
    } catch (err) {
      console.error('Update photo error:', err);
      console.error('Error details:', {
        message: err?.message,
        status: err?.status,
        response: err?.response
      });
      
      // Extract more detailed error message
      let errorMessage = 'Failed to update profile photo. Please try again.';
      if (err?.response?.message) {
        errorMessage = err.response.message;
      } else if (err?.message) {
        errorMessage = err.message;
      }
      
      console.error('Final error message:', errorMessage);
      await showAlert('Error', errorMessage, 'error');
    }
  });
}

const passwordForm = document.getElementById('passwordForm');
if (passwordForm) {
  passwordForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const currentPassword = passwordForm.current_password?.value;
    const newPassword = passwordForm.new_password?.value;
    const confirmPassword = passwordForm.confirm_password?.value;

    if (!currentPassword || !newPassword || !confirmPassword) {
      await showAlert('Error', 'All password fields are required.', 'error');
      return;
    }

    if (newPassword.length < 6) {
      await showAlert('Error', 'New password must be at least 6 characters long.', 'error');
      return;
    }

    if (newPassword !== confirmPassword) {
      await showAlert('Error', 'New passwords do not match.', 'error');
      return;
    }

    const payload = {
      current_password: currentPassword,
      new_password: newPassword,
      confirm_password: confirmPassword
    };

    try {
      const response = await api('/users/me/password', { method: 'PUT', data: payload });
      
      const message = response?.message || 'Password changed successfully. Please log in again.';
      await showAlert('Success', message, 'success');

      clearToken();
      
      setTimeout(() => {
        location.href = 'login.html';
      }, 2000);
      
    } catch (err) {
      console.error('Change password error:', err);
      const message = err?.message || 'Failed to change password';
      await showAlert('Error', message, 'error');
    }
  });
}

// Bread management
function renderBreadRow(bread) {
  const imgUrl = new URL(String(bread.image_path || 'uploads/bread.png').replace(/^\//, ''), getBase()).toString();
  const fallbackUrl = new URL('uploads/bread.png', getBase()).toString();

  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td>${bread.id}</td>
    <td>${bread.name}</td>
    <td>₱${parseFloat(bread.price).toFixed(2)}</td>
    <td>${bread.description}</td>
    <td>
      <img alt="bread image" width="80" height="80" class="bread-image" loading="lazy">
    </td>
    <td>
      <button data-action="edit" data-id="${bread.id}" class="action-btn edit-btn">Edit</button>
      <button data-action="delete" data-id="${bread.id}" class="action-btn delete-btn">Delete</button>
    </td>
  `;
  
  const img = tr.querySelector('img');
  img.src = imgUrl;
  img.onerror = () => { 
    img.onerror = null; 
    img.src = fallbackUrl; 
  };

  return tr;
}

async function loadBreads(query = '') {
  const tbody = document.querySelector('#tbl tbody');
  const messageEl = document.getElementById('breadsMsg');
  
  if (!tbody) return;
  
  try {
    const breads = await api('/breads' + (query ? `?q=${encodeURIComponent(query)}` : ''));
    
    tbody.innerHTML = '';
    
    if (breads.length === 0) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td colspan="6" style="text-align: center;">No breads found</td>`;
      tbody.appendChild(tr);
    } else {
      breads.forEach(bread => {
        tbody.appendChild(renderBreadRow(bread));
      });
    }
    
    if (messageEl) messageEl.textContent = '';
  } catch (err) {
    console.error('Load breads error:', err);
    
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Failed to load breads</td></tr>';
    }
    
    if (messageEl) {
      messageEl.textContent = 'Failed to load breads. Please try again.';
    }
  }
}

// Bread form and table handlers
const addForm = document.getElementById('addForm');
const breadTable = document.querySelector('#tbl tbody');
const searchInput = document.getElementById('search');

if (addForm && breadTable) {
  // Add new bread
  addForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = new FormData(addForm);
    
    try {
      await api('/breads', { method: 'POST', data: formData, multipart: true });
      await showAlert('Success', 'Bread added successfully!', 'success');
      addForm.reset();
      loadBreads(searchInput?.value || '');
    } catch (err) {
      console.error('Add bread error:', err);
      const message = err?.message || 'Failed to add bread';
      await showAlert('Error', message, 'error');
    }
  });

  // Handle table actions (edit/delete)
  breadTable.addEventListener('click', async (e) => {
    const button = e.target.closest('button');
    if (!button) return;

    const action = button.dataset.action;
    const id = button.dataset.id;

    if (action === 'edit') {
      location.href = `edit.html?id=${encodeURIComponent(id)}`;
      return;
    }

    if (action === 'delete') {
      const result = await Swal.fire({
        title: 'Are you sure?',
        text: "This action cannot be undone!",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Yes, delete it!'
      });

      if (result.isConfirmed) {
        try {
          await api(`/breads/${id}`, { method: 'DELETE' });
          await Swal.fire('Deleted!', 'Bread has been deleted.', 'success');
          loadBreads(searchInput?.value || '');
        } catch (err) {
          console.error('Delete bread error:', err);
          const message = err?.message || 'Failed to delete bread';
          await Swal.fire('Error', message, 'error');
        }
      }
    }
  });

  // Search functionality
  if (searchInput) {
    let searchTimeout;
    searchInput.addEventListener('input', () => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        loadBreads(searchInput.value);
      }, 300);
    });
  }

  // Initial load
  loadBreads();
}

// Edit bread functionality
async function initEdit() {
  const params = new URLSearchParams(location.search);
  const id = params.get('id');
  
  if (!id) {
    await showAlert('Error', 'No bread ID provided', 'error');
    location.href = 'bread.html';
    return;
  }

  const form = document.getElementById('editForm');
  const preview = document.getElementById('preview');
  
  if (!form) return;

  try {
    // Load existing bread data
    console.log('Loading bread data for ID:', id);
    const bread = await api(`/breads/${id}`);
    console.log('Loaded bread data:', bread);
    
    // Populate form fields
    Object.entries(bread).forEach(([key, value]) => {
      const input = form.elements[key];
      if (input && input.type !== 'file') {
        input.value = value || '';
        console.log(`Set ${key} field to:`, value);
      }
    });

    // Set image preview
    if (preview && bread.image_path) {
      console.log('Loading bread image:', bread.image_path);
      console.log('Base URL:', getBase());
      
      const imgUrl = new URL(bread.image_path.replace(/^\//, ''), getBase()).toString();
      console.log('Constructed image URL:', imgUrl);
      
      preview.src = imgUrl;
      preview.style.display = 'block';
      
      // Handle image load error
      preview.onerror = () => {
        console.warn('Failed to load bread image:', imgUrl, 'using default');
        preview.src = `${getBase().replace(/\/$/, '')}/uploads/default.png`;
      };
      
      // Handle successful load
      preview.onload = () => {
        console.log('Successfully loaded bread image:', imgUrl);
      };
      
    } else if (preview) {
      // No image, show default
      console.log('No bread image path, showing default');
      preview.src = `${getBase().replace(/\/$/, '')}/uploads/default.png`;
    }
    
  } catch (err) {
    console.error('Load bread error:', err);
    await showAlert('Error', 'Failed to load bread details', 'error');
    location.href = 'bread.html';
    return;
  }

  // Handle form submission
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = new FormData(form);
    
    // Remove keepImage field if it exists - we don't need it
    // The backend will handle keeping the existing image if no new image is provided

    try {
      await api(`/breads/${id}`, { method: 'PUT', data: formData, multipart: true });
      await showAlert('Success', 'Bread updated successfully!', 'success');
      
      setTimeout(() => {
        location.href = 'bread.html';
      }, 1000);
      
    } catch (err) {
      console.error('Update bread error:', err);
      const message = err?.message || 'Failed to update bread';
      await showAlert('Error', message, 'error');
    }
  });

  // Handle image preview
  const fileInput = form.querySelector('input[type="file"]');
  if (fileInput && preview) {
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) {
        // Validate file type
        if (!file.type.startsWith('image/')) {
          alert('Please select a valid image file.');
          fileInput.value = '';
          return;
        }
        
        // Create object URL for preview
        const objectUrl = URL.createObjectURL(file);
        
        // Update preview image
        preview.src = objectUrl;
        preview.style.display = 'block';
        
        // Clean up previous object URL
        if (preview.previousObjectUrl) {
          URL.revokeObjectURL(preview.previousObjectUrl);
        }
        preview.previousObjectUrl = objectUrl;
        
        // Clean up object URL when image loads
        preview.addEventListener('load', () => {
          // Object URL will be cleaned up when a new file is selected
        }, { once: true });
        
        // Handle preview error
        preview.onerror = () => {
          console.error('Failed to load image preview');
          preview.src = `${getBase().replace(/\/$/, '')}/uploads/default.png`;
        };
        
      } else {
        // No file selected, show default image
        preview.src = `${getBase().replace(/\/$/, '')}/uploads/default.png`;
      }
    });
  }
}

// Mobile menu toggle
function toggleMobileMenu() {
  const mobileMenu = document.getElementById('mobileMenu');
  if (mobileMenu) {
    mobileMenu.classList.toggle('hidden');
  }
}

// Status display for home page
const statusDiv = document.getElementById('status');
if (statusDiv) {
  api('/users/me')
    .then(user => {
      statusDiv.textContent = `Logged in as ${user.name} (@${user.username})`;
    })
    .catch(() => {
      statusDiv.textContent = 'Not logged in';
    });
}

// Helper: Validate token format (64 hex chars) - more lenient
function isValidTokenFormat(token) {
    return typeof token === 'string' && token.length >= 32 && /^[a-f0-9]+$/i.test(token);
}

// Helper: Logout and clear token
function forceLogout(reason) {
    localStorage.removeItem('token');
    sessionStorage.removeItem('user');
    if (reason) {
        Swal.fire({
            icon: 'warning',
            title: 'Session Ended',
            text: reason,
            timer: 2000,
            showConfirmButton: false
        });
    }
    // Redirect only if not on login/register
    const publicPages = ['login.html', 'register.html', 'forgot-password.html'];
    if (!publicPages.some(page => window.location.pathname.endsWith(page))) {
        setTimeout(() => window.location.href = 'login.html', 1500);
    }
}

// Role-based access control
async function checkAuthAndRole(requiredRole) {
  if (!isAuthed()) {
    window.location.href = 'login.html';
    return false;
  }
  
  try {
    const user = await api('/users/me');
    if (user.user_type !== requiredRole) {
      await Swal.fire({
        icon: 'error',
        title: 'Access Denied',
        text: 'You do not have permission to access this page.'
      });
      window.location.href = 'index.html';
      return false;
    }
    return true;
  } catch (err) {
    window.location.href = 'login.html';
    return false;
  }
}

// Admin Functions
async function loadUsers() {
  try {
    const users = await api('/admin/users');
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = users.map(user => `
      <tr>
        <td class="px-6 py-4 whitespace-nowrap">${user.id}</td>
        <td class="px-6 py-4 whitespace-nowrap">${user.name}</td>
        <td class="px-6 py-4 whitespace-nowrap">${user.email}</td>
        <td class="px-6 py-4 whitespace-nowrap">
          <span class="px-2 py-1 text-xs rounded ${user.user_type === 'admin' ? 'bg-red-100 text-red-800' : user.user_type === 'artisan' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}">
            ${user.user_type}
          </span>
        </td>
        <td class="px-6 py-4 whitespace-nowrap">
          <span class="px-2 py-1 text-xs rounded ${user.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
            ${user.is_active ? 'Active' : 'Inactive'}
          </span>
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
          <button onclick="editUser(${user.id})" class="text-amber-600 hover:text-amber-900 mr-3">Edit</button>
          <button onclick="deleteUser(${user.id})" class="text-red-600 hover:text-red-900">Delete</button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('Failed to load users:', err);
    await Swal.fire('Error', 'Failed to load users', 'error');
  }
}

async function editUser(id) {
  try {
    const user = await api(`/admin/users/${id}`);
    document.getElementById('userId').value = user.id;
    document.getElementById('userName').value = user.name;
    document.getElementById('userUsername').value = user.username;
    document.getElementById('userEmail').value = user.email;
    document.getElementById('userPassword').value = '';
    document.getElementById('userPassword').required = false;
    document.getElementById('userRole').value = user.user_type;
    document.getElementById('modalTitle').textContent = 'Edit User';
    document.getElementById('userModal').classList.remove('hidden');
  } catch (err) {
    await Swal.fire('Error', 'Failed to load user', 'error');
  }
}

async function deleteUser(id) {
  const result = await Swal.fire({
    title: 'Are you sure?',
    text: 'This action cannot be undone!',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#d33',
    cancelButtonColor: '#3085d6',
    confirmButtonText: 'Yes, delete it!'
  });
  
  if (result.isConfirmed) {
    try {
      await api(`/admin/users/${id}`, { method: 'DELETE' });
      await Swal.fire('Deleted!', 'User has been deleted.', 'success');
      loadUsers();
    } catch (err) {
      await Swal.fire('Error', err.message || 'Failed to delete user', 'error');
    }
  }
}

// Cart Functions
async function loadCart() {
  try {
    const cart = await api('/cart');
    const cartItems = document.getElementById('cartItems');
    const cartEmpty = document.getElementById('cartEmpty');
    const cartContent = document.getElementById('cartContent');
    
    if (!cart.items || cart.items.length === 0) {
      cartEmpty.classList.remove('hidden');
      cartContent.classList.add('hidden');
      return;
    }
    
    cartEmpty.classList.add('hidden');
    cartContent.classList.remove('hidden');
    
    cartItems.innerHTML = cart.items.map(item => `
      <div class="p-4 flex items-center space-x-4">
        <img src="${getBase()}/${item.bread.image_path}" alt="${item.bread.name}" class="w-20 h-20 object-cover rounded">
        <div class="flex-1">
          <h3 class="font-bold">${item.bread.name}</h3>
          <p class="text-gray-600">₱${item.bread.price.toFixed(2)}</p>
        </div>
        <div class="flex items-center space-x-2">
          <button onclick="updateCartQuantity(${item.id}, ${item.quantity - 1})" class="px-2 py-1 bg-gray-200 rounded">-</button>
          <span>${item.quantity}</span>
          <button onclick="updateCartQuantity(${item.id}, ${item.quantity + 1})" class="px-2 py-1 bg-gray-200 rounded">+</button>
        </div>
        <div class="text-right">
          <p class="font-bold">₱${item.subtotal.toFixed(2)}</p>
          <button onclick="removeFromCart(${item.id})" class="text-red-600 text-sm">Remove</button>
        </div>
      </div>
    `).join('');
    
    document.getElementById('cartTotal').textContent = `₱${cart.total.toFixed(2)}`;
  } catch (err) {
    console.error('Failed to load cart:', err);
  }
}

async function updateCartQuantity(id, quantity) {
  if (quantity < 1) {
    removeFromCart(id);
    return;
  }
  try {
    await api(`/cart/${id}`, { method: 'PUT', data: { quantity } });
    loadCart();
    updateCartCount();
  } catch (err) {
    await Swal.fire('Error', err.message || 'Failed to update cart', 'error');
  }
}

async function removeFromCart(id) {
  try {
    await api(`/cart/${id}`, { method: 'DELETE' });
    loadCart();
    updateCartCount();
  } catch (err) {
    await Swal.fire('Error', 'Failed to remove item', 'error');
  }
}

async function updateCartCount() {
  try {
    const cart = await api('/cart');
    const count = cart.items ? cart.items.reduce((sum, item) => sum + item.quantity, 0) : 0;
    document.getElementById('cartCount').textContent = count;
  } catch (err) {
    document.getElementById('cartCount').textContent = '0';
  }
}

// Order Functions
async function loadOrders() {
  try {
    const orders = await api('/orders');
    const ordersList = document.getElementById('ordersList');
    const ordersEmpty = document.getElementById('ordersEmpty');
    
    if (!orders || orders.length === 0) {
      ordersEmpty.classList.remove('hidden');
      ordersList.classList.add('hidden');
      return;
    }
    
    ordersEmpty.classList.add('hidden');
    ordersList.classList.remove('hidden');
    
    ordersList.innerHTML = orders.map(order => `
      <div class="bg-white rounded-lg shadow p-6">
        <div class="flex justify-between items-start mb-4">
          <div>
            <h3 class="text-lg font-bold">Order #${order.id}</h3>
            <p class="text-gray-600">${new Date(order.created_at).toLocaleDateString()}</p>
          </div>
          <div class="text-right">
            <span class="px-3 py-1 rounded text-sm ${order.status === 'completed' ? 'bg-green-100 text-green-800' : order.status === 'cancelled' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}">
              ${order.status}
            </span>
            <p class="text-xl font-bold mt-2">₱${order.total_amount.toFixed(2)}</p>
          </div>
        </div>
        <div class="space-y-2">
          ${order.items.map(item => `
            <div class="flex justify-between">
              <span>${item.bread.name} x${item.quantity}</span>
              <span>₱${item.subtotal.toFixed(2)}</span>
            </div>
          `).join('')}
        </div>
        ${order.status === 'pending' ? `
          <button onclick="cancelOrder(${order.id})" class="mt-4 text-red-600 hover:text-red-800">Cancel Order</button>
        ` : ''}
      </div>
    `).join('');
  } catch (err) {
    console.error('Failed to load orders:', err);
  }
}

async function cancelOrder(id) {
  const result = await Swal.fire({
    title: 'Cancel Order?',
    text: 'Are you sure you want to cancel this order?',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Yes, cancel it'
  });
  
  if (result.isConfirmed) {
    try {
      await api(`/orders/${id}/cancel`, { method: 'PUT' });
      await Swal.fire('Cancelled!', 'Order has been cancelled.', 'success');
      loadOrders();
    } catch (err) {
      await Swal.fire('Error', err.message || 'Failed to cancel order', 'error');
    }
  }
}

// Artisan Functions
async function loadArtisanDashboard() {
  try {
    const dashboard = await api('/artisan/dashboard');
    document.getElementById('totalBreads').textContent = dashboard.statistics.total_breads;
    document.getElementById('totalStock').textContent = dashboard.statistics.total_stock;
    document.getElementById('totalValue').textContent = `₱${dashboard.statistics.total_value.toFixed(2)}`;
    document.getElementById('lowStock').textContent = dashboard.statistics.low_stock_count;
    
    const tbody = document.getElementById('breadsTableBody');
    if (tbody) {
      tbody.innerHTML = dashboard.breads.map(bread => `
        <tr>
          <td class="px-6 py-4"><img src="${getBase()}/${bread.image_path}" alt="${bread.name}" class="w-16 h-16 object-cover rounded"></td>
          <td class="px-6 py-4">${bread.name}</td>
          <td class="px-6 py-4">₱${bread.price.toFixed(2)}</td>
          <td class="px-6 py-4">${bread.stock_quantity}</td>
          <td class="px-6 py-4">
            <a href="edit.html?id=${bread.id}" class="text-amber-600 hover:text-amber-900">Edit</a>
          </td>
        </tr>
      `).join('');
    }
  } catch (err) {
    console.error('Failed to load dashboard:', err);
  }
}

// Bread Detail
async function loadBreadDetail(id) {
  try {
    const bread = await api(`/breads/${id}`);
    const detail = document.getElementById('breadDetail');
    if (detail) {
      detail.innerHTML = `
        <div class="md:flex">
          <div class="md:w-1/2">
            <img src="${getBase()}/${bread.image_path}" alt="${bread.name}" class="w-full h-96 object-cover">
          </div>
          <div class="md:w-1/2 p-8">
            <h1 class="text-3xl font-bold mb-4">${bread.name}</h1>
            <p class="text-2xl font-bold text-amber-600 mb-4">₱${bread.price.toFixed(2)}</p>
            <p class="text-gray-600 mb-4">${bread.description || 'No description'}</p>
            <p class="mb-4">Stock: ${bread.stock_quantity || 0}</p>
            ${isAuthed() ? `
              <button onclick="addToCartFromDetail(${bread.id})" class="bg-amber-600 text-white px-6 py-3 rounded-lg hover:bg-amber-700">
                Add to Cart
              </button>
            ` : '<a href="login.html" class="bg-amber-600 text-white px-6 py-3 rounded-lg hover:bg-amber-700 inline-block">Login to Add to Cart</a>'}
          </div>
        </div>
      `;
    }
  } catch (err) {
    console.error('Failed to load bread detail:', err);
  }
}

async function addToCartFromDetail(breadId) {
  try {
    await api('/cart', { method: 'POST', data: { bread_id: breadId, quantity: 1 } });
    await Swal.fire('Success', 'Added to cart!', 'success');
    updateCartCount();
  } catch (err) {
    await Swal.fire('Error', err.message || 'Failed to add to cart', 'error');
  }
}

// Expose functions globally for use in HTML
window.requireAuth = requireAuth;
window.checkAuthStatus = checkAuthStatus;
window.loadProfile = loadProfile;
window.updateProfileImage = updateProfileImage;
window.initEdit = initEdit;
window.toggleMobileMenu = toggleMobileMenu;
window.checkAuthAndRole = checkAuthAndRole;
window.loadUsers = loadUsers;
window.editUser = editUser;
window.deleteUser = deleteUser;
window.loadCart = loadCart;
window.updateCartQuantity = updateCartQuantity;
window.removeFromCart = removeFromCart;
window.updateCartCount = updateCartCount;
window.loadOrders = loadOrders;
window.cancelOrder = cancelOrder;
window.loadArtisanDashboard = loadArtisanDashboard;
window.loadBreadDetail = loadBreadDetail;

window.addToCartFromDetail = addToCartFromDetail;


