document.addEventListener('DOMContentLoaded', () => {
    const navButtons = document.querySelectorAll('.nav-button');
    const screens = document.querySelectorAll('.screen');
    const addPostButton = document.getElementById('add-post-button');
    const cancelPostButton = document.getElementById('cancel-post-button');
    const newPostForm = document.getElementById('new-post-form');
    const bookCoverUpload = document.getElementById('book-cover-upload');
    const bookCoverPreview = document.getElementById('book-cover-preview');
    const feedScreen = document.getElementById('feed-screen');
    const postsList = feedScreen.querySelector('.posts-list');
    const profileUsername = document.getElementById('profile-username');
    const profileBio = document.getElementById('profile-bio');
    const profileRole = document.getElementById('profile-role');
    const authForm = document.getElementById('auth-form');
    const registerButton = document.getElementById('register-button');
    const logoutButton = document.getElementById('logout-button');
    const loginNavButton = document.getElementById('login-nav-button');
    const editBioButton = document.querySelector('.edit-bio-button');

    let currentUser = null; // Stores current logged-in user
    let posts = []; // Stores all posts
    let users = [
        { username: 'ketab', password: '123', role: 'admin', bio: 'مدیر سیستم و علاقه‌مند به کتاب', likedPosts: new Set() },
        { username: 'کاربر کتاب‌دوست', password: 'userpassword', role: 'user', bio: 'علاقه‌مند به ادبیات کلاسیک و فلسفه', likedPosts: new Set() },
        { username: 'کتاب‌خوان حرفه‌ای', password: 'userpassword2', role: 'user', bio: 'کتاب‌ها پنجره‌ای رو به دنیاهای جدید.', likedPosts: new Set() }
    ];

    // Initial example posts
    posts.push({
        id: 1,
        username: 'کاربر کتاب‌دوست',
        role: 'user',
        bookTitle: 'چهار اثر از فلورانس اسکاول شین',
        bookAuthor: 'فلورانس اسکاول شین',
        bookQuote: 'همواره به یاد داشته باشید که هر چه را که به جهان هستی می‌دهید، به سوی شما باز می‌گردد.',
        likes: 0,
        likedBy: [],
        comments: [{ id: 1, author: 'کتاب‌خوان حرفه‌ای', role: 'user', text: 'کتاب فوق‌العاده‌ای بود!' }]
    });

    posts.push({
        id: 2,
        username: 'کاربر کتاب‌گرد',
        role: 'user',
        bookTitle: 'کیمیاگر',
        bookAuthor: 'پائولو کوئلیو',
        bookQuote: 'وقتی آرزوئی داری، تمام کائنات همواره با تو دست به یکی می‌شوند تا آن را برآورده کنی.',
        likes: 0,
        likedBy: [],
        comments: []
    });

    // Function to show a specific screen
    const showScreen = (screenId) => {
        screens.forEach(screen => {
            screen.classList.remove('active');
        });
        document.getElementById(screenId).classList.add('active');

        // Update active nav button
        navButtons.forEach(button => {
            if (button.dataset.target === screenId) {
                button.classList.add('active');
            } else {
                button.classList.remove('active');
            }
        });

        // Show/hide FAB based on screen
        if (screenId === 'feed-screen' && currentUser) {
            addPostButton.style.display = 'flex';
        } else {
            addPostButton.style.display = 'none';
        }

        // Update login/logout button visibility and profile info
        if (currentUser) {
            loginNavButton.style.display = 'none';
            logoutButton.style.display = 'block';
            profileUsername.textContent = currentUser.username;
            profileRole.textContent = currentUser.role === 'admin' ? 'مدیر' : 'کاربر';
            profileBio.textContent = currentUser.bio;
            editBioButton.style.display = 'flex';
            if (profileBio.querySelector('textarea')) {
                profileBio.innerHTML = currentUser.bio;
            }
        } else {
            loginNavButton.style.display = 'flex';
            logoutButton.style.display = 'none';
            profileUsername.textContent = 'کاربر مهمان';
            profileRole.textContent = 'مهمان';
            profileBio.textContent = 'برای مشاهده و ارسال پست وارد شوید.';
            editBioButton.style.display = 'none';
        }

        updateAdminControls();
    };

    // Function to update admin controls
    const updateAdminControls = () => {
        const adminElements = document.querySelectorAll('.admin-only');
        if (currentUser && currentUser.role === 'admin') {
            adminElements.forEach(el => el.style.display = 'inline-flex');
        } else {
            adminElements.forEach(el => el.style.display = 'none');
        }
    };

    // Navigation buttons functionality
    navButtons.forEach(button => {
        button.addEventListener('click', () => {
            showScreen(button.dataset.target);
        });
    });

    // FAB - Add Post button
    addPostButton.addEventListener('click', () => {
        if (currentUser) {
            showScreen('add-post-screen');
        } else {
            alert('لطفاً ابتدا وارد شوید تا بتوانید پست ارسال کنید.');
            showScreen('login-screen');
        }
    });

    // Cancel Post button
    cancelPostButton.addEventListener('click', () => {
        showScreen('feed-screen');
        newPostForm.reset();
        bookCoverPreview.style.display = 'none';
        bookCoverPreview.src = '#';
    });

    // Book Cover Image Preview
    bookCoverUpload.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                bookCoverPreview.src = e.target.result;
                bookCoverPreview.style.display = 'block';
            };
            reader.readAsDataURL(file);
        } else {
            bookCoverPreview.style.display = 'none';
            bookCoverPreview.src = '#';
        }
    });

    // Handle New Post Submission
    newPostForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        if (!currentUser) {
            alert('برای ارسال پست باید وارد شوید.');
            showScreen('login-screen');
            return;
        }

        const bookTitle = document.getElementById('book-title').value;
        const bookAuthor = document.getElementById('book-author').value;
        const bookQuote = document.getElementById('book-quote').value;
        const bookCoverFile = document.getElementById('book-cover-upload').files[0];

        let bookCoverURL = '';
        const postId = posts.length > 0 ? Math.max(...posts.map(p => p.id)) + 1 : 1;

        if (bookCoverFile) {
            const reader = new FileReader();
            reader.onload = (e) => {
                bookCoverURL = e.target.result;
                const newPost = {
                    id: postId,
                    username: currentUser.username,
                    role: currentUser.role,
                    bookTitle,
                    bookAuthor,
                    bookQuote,
                    bookCoverURL,
                    likes: 0,
                    likedBy: [],
                    comments: []
                };
                posts.unshift(newPost);
                renderPosts();
                newPostForm.reset();
                bookCoverPreview.style.display = 'none';
                bookCoverPreview.src = '#';
                showScreen('feed-screen');
                alert('پست با موفقیت منتشر شد!');
            };
            reader.readAsDataURL(bookCoverFile);
        } else {
            const newPost = {
                id: postId,
                username: currentUser.username,
                role: currentUser.role,
                bookTitle,
                bookAuthor,
                bookQuote,
                bookCoverURL: '',
                likes: 0,
                likedBy: [],
                comments: []
            };
            posts.unshift(newPost);
            renderPosts();
            newPostForm.reset();
            bookCoverPreview.style.display = 'none';
            bookCoverPreview.src = '#';
            showScreen('feed-screen');
            alert('پست با موفقیت منتشر شد!');
        }
    });

    const renderPosts = () => {
        postsList.innerHTML = '';
        const userPostsList = document.querySelector('#profile-screen .user-posts-list');
        if (userPostsList) userPostsList.innerHTML = '';

        posts.forEach(post => {
            const newPostCard = createPostCard(post);
            postsList.appendChild(newPostCard);

            if (currentUser && post.username === currentUser.username) {
                const userPostCard = createPostCard(post, true);
                if (userPostsList) userPostsList.appendChild(userPostCard);
            }
        });
        updateAdminControls();
    };

    const createPostCard = (post, isProfileView = false) => {
        const postCard = document.createElement('div');
        postCard.classList.add('post-card');
        postCard.dataset.postId = post.id;

        let postHeaderHtml = '';
        if (!isProfileView) {
            postHeaderHtml = `
                <div class="post-header">
                    <div class="post-avatar">
                        <div class="avatar-placeholder">${(post.username || 'U').charAt(0).toUpperCase()}</div>
                    </div>
                    <span class="post-username">${post.username}</span>
                    <span class="post-role">(${post.role === 'admin' ? 'مدیر' : 'کاربر'})</span>
                </div>
            `;
        }

        const likedByCurrentUser = currentUser && post.likedBy && post.likedBy.includes(currentUser.username);
        const likeButtonClass = likedByCurrentUser ? 'action-button like-button liked' : 'action-button like-button';

        postCard.innerHTML = `
            ${postHeaderHtml}
            <div class="post-content">
                ${post.bookCoverURL ? `<img src="${post.bookCoverURL}" alt="Book Cover" class="book-cover">` : ''}
                <h3 class="book-title">${post.bookTitle}</h3>
                <p class="book-author">نویسنده: ${post.bookAuthor}</p>
                <blockquote class="book-quote">"${post.bookQuote}"</blockquote>
            </div>
            <div class="post-actions">
                <button class="${likeButtonClass}" ${likedByCurrentUser ? 'disabled' : ''}>
                    <span class="material-icons">thumb_up</span> لایک (<span class="like-count">${post.likes || 0}</span>)
                </button>
                <button class="action-button comment-toggle-button">
                    <span class="material-icons">comment</span> کامنت (${post.comments ? post.comments.length : 0})
                </button>
                ${currentUser && (currentUser.role === 'admin' || post.username === currentUser.username) ? 
                    `<button class="action-button delete-post-button admin-only" style="display: none;">
                        <span class="material-icons">delete</span> حذف
                    </button>` : ''
                }
            </div>
            <div class="comments-section" style="display: none;">
                <div class="comments-list">
                    ${post.comments ? post.comments.map(comment => `
                        <div class="comment" data-comment-id="${comment.id}">
                            <div class="comment-header">
                                <span class="comment-author">${comment.author}</span>
                                <span class="comment-time">${comment.timestamp ? new Date(comment.timestamp).toLocaleString('fa-IR') : ''}</span>
                            </div>
                            <div class="comment-text">${comment.text}</div>
                            ${currentUser && (currentUser.role === 'admin' || comment.author === currentUser.username) ? 
                                `<button class="delete-comment-button admin-only" style="display: none;">
                                    <span class="material-icons">close</span>
                                </button>` : ''
                            }
                        </div>
                    `).join('') : ''}
                </div>
                <form class="add-comment-form">
                    <input type="text" placeholder="نظر خود را بنویسید..." class="comment-input">
                    <button type="submit">ارسال</button>
                </form>
            </div>
        `;

        // Add event listeners for new elements
        postCard.querySelector('.like-button').addEventListener('click', (e) => handleLike(e, post.id));
        postCard.querySelector('.comment-toggle-button').addEventListener('click', (e) => toggleComments(e));
        postCard.querySelector('.add-comment-form').addEventListener('submit', (e) => addComment(e, post.id));
        
        const deletePostButton = postCard.querySelector('.delete-post-button');
        if (deletePostButton) {
            deletePostButton.addEventListener('click', () => deletePost(post.id));
        }
        
        postCard.querySelectorAll('.delete-comment-button').forEach(button => {
            button.addEventListener('click', (e) => {
                const commentEl = e.target.closest('.comment');
                if (commentEl) {
                    const commentId = commentEl.dataset.commentId;
                    deleteComment(post.id, commentId);
                }
            });
        });

        return postCard;
    };

    const handleLike = (e, postId) => {
        if (!currentUser) {
            alert('برای لایک کردن باید وارد شوید.');
            showScreen('login-screen');
            return;
        }

        const post = posts.find(p => p.id === postId);
        if (!post) return;

        const likedBy = post.likedBy || [];
        const userLiked = likedBy.includes(currentUser.username);

        if (userLiked) {
            alert('شما قبلاً این پست را لایک کرده‌اید!');
            return;
        }

        // Update post
        post.likes = (post.likes || 0) + 1;
        post.likedBy = [...likedBy, currentUser.username];

        // Update UI
        e.currentTarget.classList.add('liked');
        e.currentTarget.disabled = true;
        e.currentTarget.style.opacity = '0.7';
        e.currentTarget.style.cursor = 'not-allowed';
        e.currentTarget.querySelector('.like-count').textContent = post.likes;

        alert('پست لایک شد!');
    };

    const toggleComments = (e) => {
        const commentsSection = e.currentTarget.closest('.post-card').querySelector('.comments-section');
        if (commentsSection) {
            commentsSection.style.display = commentsSection.style.display === 'none' ? 'block' : 'none';
        }
    };

    const addComment = (e, postId) => {
        e.preventDefault();
        if (!currentUser) {
            alert('برای ارسال کامنت باید وارد شوید.');
            showScreen('login-screen');
            return;
        }
        
        const commentInput = e.target.querySelector('.comment-input');
        const commentText = commentInput.value.trim();
        
        if (!commentText) return;

        const post = posts.find(p => p.id === postId);
        if (post) {
            const commentId = post.comments.length > 0 ? Math.max(...post.comments.map(c => c.id)) + 1 : 1;
            post.comments.push({ 
                id: commentId, 
                author: currentUser.username, 
                role: currentUser.role, 
                text: commentText,
                timestamp: new Date()
            });
            renderPosts();
            commentInput.value = '';
            alert('کامنت با موفقیت اضافه شد!');
        }
    };

    const deletePost = (postId) => {
        if (!currentUser || (currentUser.role !== 'admin' && posts.find(p => p.id === postId)?.username !== currentUser.username)) {
            alert('شما دسترسی حذف پست را ندارید.');
            return;
        }
        
        if (confirm('آیا مطمئن هستید که می‌خواهید این پست را حذف کنید؟')) {
            posts = posts.filter(post => post.id !== postId);
            renderPosts();
            alert('پست با موفقیت حذف شد!');
        }
    };

    const deleteComment = (postId, commentId) => {
        if (!currentUser || currentUser.role !== 'admin') {
            alert('شما دسترسی حذف کامنت را ندارید.');
            return;
        }
        
        if (confirm('آیا مطمئن هستید که می‌خواهید این کامنت را حذف کنید؟')) {
            const post = posts.find(p => p.id === postId);
            if (post) {
                post.comments = post.comments.filter(comment => comment.id !== parseInt(commentId));
                renderPosts();
                alert('کامنت با موفقیت حذف شد!');
            }
        }
    };

    // Auth Form Submission (Login/Register)
    authForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const usernameInput = document.getElementById('username').value;
        const passwordInput = document.getElementById('password').value;

        const foundUser = users.find(u => u.username === usernameInput && u.password === passwordInput);

        if (foundUser) {
            currentUser = { username: foundUser.username, role: foundUser.role, bio: foundUser.bio };
            alert(`خوش آمدید، ${currentUser.username}!`);
            showScreen('feed-screen');
        } else {
            alert('نام کاربری یا رمز عبور اشتباه است.');
        }
    });

    registerButton.addEventListener('click', () => {
        const usernameInput = document.getElementById('username').value;
        const passwordInput = document.getElementById('password').value;

        if (usernameInput.trim() === '' || passwordInput.trim() === '') {
            alert('نام کاربری و رمز عبور نمی‌توانند خالی باشند.');
            return;
        }

        if (users.some(u => u.username === usernameInput)) {
            alert('این نام کاربری قبلاً گرفته شده است.');
        } else {
            users.push({ 
                username: usernameInput, 
                password: passwordInput, 
                role: 'user', 
                bio: 'عضو جدید کتاب‌گرد هستم!', 
                likedPosts: new Set() 
            });
            alert('ثبت نام با موفقیت انجام شد. اکنون می‌توانید وارد شوید.');
            authForm.reset();
        }
    });

    logoutButton.addEventListener('click', () => {
        currentUser = null;
        alert('از حساب خود خارج شدید.');
        showScreen('login-screen');
    });

    // Edit Bio functionality
    editBioButton.addEventListener('click', () => {
        if (!currentUser) return;

        if (profileBio.querySelector('textarea')) {
            // If already in edit mode, save changes
            const newBio = profileBio.querySelector('textarea').value.trim();
            currentUser.bio = newBio;
            const userInArray = users.find(u => u.username === currentUser.username);
            if (userInArray) {
                userInArray.bio = newBio;
            }
            profileBio.innerHTML = newBio;
            editBioButton.innerHTML = '<span class="material-icons">edit</span> ویرایش بیو';
            alert('بیو با موفقیت به‌روزرسانی شد!');
        } else {
            // Enter edit mode
            const currentBio = profileBio.textContent;
            profileBio.innerHTML = `<textarea class="bio-edit-input">${currentBio}</textarea>`;
            profileBio.querySelector('textarea').focus();
            editBioButton.innerHTML = '<span class="material-icons">done</span> ذخیره بیو';
        }
    });

    // Initial render and screen load
    renderPosts();
    showScreen('login-screen');
});