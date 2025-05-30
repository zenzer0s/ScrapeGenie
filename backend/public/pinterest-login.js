document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');
    const messageDiv = document.getElementById('message');
    const submitBtn = document.getElementById('submitBtn');
    
    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        
        // Add before the fetch call:
        if (!username || username.trim() === '') {
            messageDiv.textContent = 'Please enter your Pinterest username';
            messageDiv.classList.remove('hidden', 'success');
            messageDiv.classList.add('error');
            submitBtn.innerHTML = 'Connect Pinterest Account';
            submitBtn.disabled = false;
            return;
        }

        if (!password) {
            messageDiv.textContent = 'Please enter your Pinterest password';
            messageDiv.classList.remove('hidden', 'success');
            messageDiv.classList.add('error');
            submitBtn.innerHTML = 'Connect Pinterest Account';
            submitBtn.disabled = false;
            return;
        }
        
        // Get the token from URL
        const token = window.location.pathname.split('/').pop();
        
        submitBtn.innerHTML = '<span class="loading"></span>Connecting...';
        submitBtn.disabled = true;
        
        try {
            const csrfToken = document.getElementById('csrfToken').value;
            
            const response = await fetch(`/api/auth/login/${token}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': csrfToken
                },
                body: JSON.stringify({ username, password })
            });
            
            const data = await response.json();
            
            if (data.success) {
                messageDiv.textContent = '✅ Pinterest connected successfully! You can close this window.';
                messageDiv.classList.remove('hidden', 'error');
                messageDiv.classList.add('success');
                
                // Hide the form
                loginForm.style.display = 'none';
                
                // Notify parent window if this was opened in a popup
                if (window.opener) {
                    const allowedOrigin = window.location.origin;
                    window.opener.postMessage({ type: 'pinterest_connected', success: true }, allowedOrigin);
                }
            } else {
                if (data.error === 'invalid_credentials') {
                    messageDiv.textContent = 'Incorrect username or password. Please try again.';
                } else if (data.error === 'account_locked') {
                    messageDiv.textContent = 'Your account appears to be locked. Please verify it through Pinterest first.';
                } else {
                    messageDiv.textContent = data.error || 'Connection failed. Please check your credentials and try again.';
                }
                messageDiv.classList.remove('hidden', 'success');
                messageDiv.classList.add('error');
                
                submitBtn.innerHTML = 'Connect Pinterest Account';
                submitBtn.disabled = false;
            }
        } catch (error) {
            console.error('Login error:', error);
            messageDiv.textContent = 'Connection failed. Please try again later.';
            messageDiv.classList.remove('hidden', 'success');
            messageDiv.classList.add('error');
            
            submitBtn.innerHTML = 'Connect Pinterest Account';
            submitBtn.disabled = false;
        }
    });
});