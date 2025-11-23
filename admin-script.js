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
                await api(`/admin/users/${userId}`, { method: 'PUT', data });
                await Swal.fire('Success', 'User updated!', 'success');
            } else {
                await api('/admin/users', { method: 'POST', data });
                await Swal.fire('Success', 'User created!', 'success');
            }
            $('#userModal').addClass('hidden');
            loadUsers();
        } catch (err) {
            await Swal.fire('Error', err.message || 'Operation failed', 'error');
        }
    });
});

