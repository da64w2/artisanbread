$(document).ready(function() {
    checkAuthAndRole('admin');
    loadUsers();
    
    $('#btnCreateUser').click(function() {
        $('#userForm')[0].reset();
        $('#userId').val('');
        $('#userPassword').required = true;
        $('#modalTitle').text('Create User');
        $('#userModal').removeClass('hidden');
    });
    
    $('#btnCancelModal').click(function() {
        $('#userModal').addClass('hidden');
    });
    
    $('#userForm').submit(async function(e) {
        e.preventDefault();
        const userId = $('#userId').val();
        const data = {
            name: $('#userName').val(),
            username: $('#userUsername').val(),
            email: $('#userEmail').val(),
            user_type: $('#userRole').val()
        };
        
        if ($('#userPassword').val()) {
            data.password = $('#userPassword').val();
        }
        
        try {
            if (userId) {
                const updatedUser = await api(`/admin/users/${userId}`, { method: 'PUT', data });
                await Swal.fire({
                    title: 'Success!',
                    html: `
                        <div class="text-left">
                            <p class="mb-2"><strong>User updated successfully!</strong></p>
                            <p class="text-sm text-gray-600">Name: ${updatedUser.name || data.name}</p>
                            <p class="text-sm text-gray-600">Email: ${updatedUser.email || data.email}</p>
                            <p class="text-sm text-gray-600">Role: ${updatedUser.user_type || data.user_type}</p>
                        </div>
                    `,
                    icon: 'success',
                    confirmButtonText: 'OK',
                    confirmButtonColor: '#d97706'
                });
            } else {
                const response = await api('/admin/users', { method: 'POST', data });
                const newUser = response.user || response; // Handle both response formats
                
                await Swal.fire({
                    title: 'User Created Successfully!',
                    html: `
                        <div class="text-left">
                            <p class="mb-3"><strong>New user has been added to the system.</strong></p>
                            <div class="bg-gray-50 p-3 rounded-lg mb-3">
                                <p class="text-sm mb-1"><strong>User ID:</strong> ${newUser.id || 'N/A'}</p>
                                <p class="text-sm mb-1"><strong>Name:</strong> ${newUser.name || data.name}</p>
                                <p class="text-sm mb-1"><strong>Username:</strong> ${newUser.username || data.username}</p>
                                <p class="text-sm mb-1"><strong>Email:</strong> ${newUser.email || data.email}</p>
                                <p class="text-sm mb-1"><strong>Role:</strong> <span class="px-2 py-1 bg-amber-100 text-amber-800 rounded text-xs font-semibold">${(newUser.user_type || data.user_type).toUpperCase()}</span></p>
                                <p class="text-sm"><strong>Status:</strong> <span class="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-semibold">ACTIVE</span></p>
                            </div>
                            <p class="text-xs text-gray-500">The user can now login with the provided credentials.</p>
                        </div>
                    `,
                    icon: 'success',
                    confirmButtonText: 'OK',
                    confirmButtonColor: '#d97706',
                    width: '500px'
                });
            }
            $('#userModal').addClass('hidden');
            loadUsers();
        } catch (err) {
            await Swal.fire({
                title: 'Error',
                text: err.message || 'Operation failed. Please try again.',
                icon: 'error',
                confirmButtonText: 'OK'
            });
        }
    });
});

