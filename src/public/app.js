// API Base URL
const API_BASE = window.location.origin + '/api';

// Get JWT token from localStorage
function getToken() {
    return localStorage.getItem('jwt_token');
}

// Set JWT token in localStorage
function setToken(token) {
    localStorage.setItem('jwt_token', token);
}

// Show/hide spinner
function toggleSpinner(spinnerId, show) {
    const spinner = document.getElementById(spinnerId);
    if (spinner) {
        spinner.classList.toggle('hidden', !show);
    }
}

// Show result message
function showResult(elementId, message, type = 'info') {
    const element = document.getElementById(elementId);
    element.className = `alert alert-${type}`;
    element.innerHTML = message;
    element.classList.remove('hidden');
}

// Hide result message
function hideResult(elementId) {
    const element = document.getElementById(elementId);
    element.classList.add('hidden');
}

// Generic API call function
async function apiCall(method, endpoint, data = null, useFormData = false) {
    const options = {
        method: method,
        headers: {}
    };

    // Add auth header if token exists
    const token = getToken();
    if (token) {
        options.headers['Authorization'] = `Bearer ${token}`;
    }

    // Add body for POST/PUT
    if (data) {
        if (useFormData) {
            options.body = data; // FormData
        } else {
            options.headers['Content-Type'] = 'application/json';
            options.body = JSON.stringify(data);
        }
    }

    try {
        const response = await fetch(API_BASE + endpoint, options);
        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || 'Request failed');
        }

        return result;
    } catch (error) {
        throw new Error(error.message || 'Network error');
    }
}

// Login function
async function login() {
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    if (!email || !password) {
        showResult('loginResult', 'Please enter email and password', 'danger');
        return;
    }

    toggleSpinner('loginSpinner', true);
    hideResult('loginResult');

    try {
        const result = await apiCall('POST', '/auth/login', { email, password });

        if (result.success && result.data.token) {
            setToken(result.data.token);
            showResult('loginResult', `
                <strong>✅ Login Successful!</strong><br>
                User ID: ${result.data.userId}<br>
                Username: ${result.data.username}<br>
                Daily Goal: ${result.data.daily_calorie_goal} calories<br>
                Token saved to localStorage
            `, 'success');
        }
    } catch (error) {
        showResult('loginResult', `❌ Login failed: ${error.message}`, 'danger');
    } finally {
        toggleSpinner('loginSpinner', false);
    }
}

// Upload meal function
async function uploadMeal() {
    const fileInput = document.getElementById('mealFile');
    const mealType = document.getElementById('mealType').value;
    const mealDate = document.getElementById('mealDate').value;

    if (!fileInput.files[0]) {
        showResult('uploadResult', 'Please select a photo', 'danger');
        return;
    }

    if (!getToken()) {
        showResult('uploadResult', 'Please login first', 'danger');
        return;
    }

    toggleSpinner('uploadSpinner', true);
    hideResult('uploadResult');

    try {
        const formData = new FormData();
        formData.append('file', fileInput.files[0]);
        formData.append('meal_type', mealType);
        formData.append('meal_date', mealDate);

        const result = await apiCall('POST', '/meals/upload', formData, true);

        if (result.success) {
            let html = '<strong>✅ Meal Uploaded!</strong><br>';
            html += `Meal ID: ${result.data.mealId}<br>`;

            if (result.data.foods && result.data.foods.length > 0) {
                html += `<strong>Detected Foods:</strong><br>`;
                result.data.foods.forEach(food => {
                    html += `• ${food.food_name} - ${food.calories} cal<br>`;
                });
                html += `<strong>Total: ${result.data.totalCalories} calories</strong>`;
            } else if (result.data.note) {
                html += `<em>${result.data.note}</em>`;
            }

            showResult('uploadResult', html, 'success');
            fileInput.value = ''; // Clear file input
        }
    } catch (error) {
        showResult('uploadResult', `❌ Upload failed: ${error.message}`, 'danger');
    } finally {
        toggleSpinner('uploadSpinner', false);
    }
}

// Load dashboard function
async function loadDashboard() {
    const date = document.getElementById('dashboardDate').value;

    if (!getToken()) {
        showResult('dashboardResult', '<div class="alert alert-danger">Please login first</div>');
        return;
    }

    toggleSpinner('dashboardSpinner', true);
    document.getElementById('dashboardResult').innerHTML = '';

    try {
        const result = await apiCall('GET', `/dashboard?date=${date}`);

        if (result.success) {
            const data = result.data;
            const progressPercent = Math.min(data.progress_percent, 100);
            const progressClass = data.goal_achieved ? 'progress-bar-success' :
                                 (progressPercent < 110 ? 'progress-bar-warning' : 'progress-bar-danger');

            let html = `
                <div class="row mb-3">
                    <div class="col-md-4">
                        <div class="card">
                            <div class="card-body text-center">
                                <h6>Daily Goal</h6>
                                <h3>${data.daily_goal}</h3>
                                <small>calories</small>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-4">
                        <div class="card">
                            <div class="card-body text-center">
                                <h6>Total Consumed</h6>
                                <h3>${data.total_calories}</h3>
                                <small>calories</small>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-4">
                        <div class="card">
                            <div class="card-body text-center">
                                <h6>Remaining</h6>
                                <h3>${data.remaining_calories}</h3>
                                <small>calories</small>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="mb-3">
                    <h6>Progress: ${progressPercent.toFixed(1)}%</h6>
                    <div class="progress" style="height: 30px;">
                        <div class="progress-bar ${progressClass}" role="progressbar"
                             style="width: ${progressPercent}%"
                             aria-valuenow="${progressPercent}" aria-valuemin="0" aria-valuemax="100">
                            ${progressPercent.toFixed(1)}%
                        </div>
                    </div>
                    <div class="text-center mt-2">
                        ${data.goal_achieved ?
                            '<span class="badge bg-success">✅ On Track!</span>' :
                            '<span class="badge bg-danger">⚠️ Over Goal</span>'}
                    </div>
                </div>
                <h6>Meals (${data.meals.length}):</h6>
            `;

            if (data.meals.length === 0) {
                html += '<p class="text-muted">No meals logged for this date.</p>';
            } else {
                data.meals.forEach(meal => {
                    html += `
                        <div class="card meal-card mb-2">
                            <div class="card-body">
                                <div class="d-flex justify-content-between">
                                    <strong>${meal.meal_type.charAt(0).toUpperCase() + meal.meal_type.slice(1)}</strong>
                                    <span class="badge bg-primary">${meal.calories} cal</span>
                                </div>
                                ${meal.photo_url ? `<img src="${meal.photo_url}" class="meal-photo" alt="Meal photo">` : ''}
                                <div class="mt-2">
                    `;

                    meal.foods.forEach(food => {
                        html += `
                            <div class="food-item">
                                <span>${food.food_name}</span>
                                <span class="float-end text-muted">${food.calories} cal</span>
                            </div>
                        `;
                    });

                    html += `
                                </div>
                            </div>
                        </div>
                    `;
                });
            }

            document.getElementById('dashboardResult').innerHTML = html;
        }
    } catch (error) {
        document.getElementById('dashboardResult').innerHTML =
            `<div class="alert alert-danger">❌ Failed to load dashboard: ${error.message}</div>`;
    } finally {
        toggleSpinner('dashboardSpinner', false);
    }
}

// Load history function
async function loadHistory() {
    const startDate = document.getElementById('historyStartDate').value;
    const endDate = document.getElementById('historyEndDate').value;

    if (!getToken()) {
        showResult('historyResult', '<div class="alert alert-danger">Please login first</div>');
        return;
    }

    toggleSpinner('historySpinner', true);
    document.getElementById('historyResult').innerHTML = '';

    try {
        const result = await apiCall('GET', `/meals/history?startDate=${startDate}&endDate=${endDate}`);

        if (result.success) {
            const data = result.data;

            let html = `<p><strong>Total Meals: ${data.totalMealsLogged}</strong> (${data.dateRange.start} to ${data.dateRange.end})</p>`;

            if (data.meals.length === 0) {
                html += '<p class="text-muted">No meals found in this date range.</p>';
            } else {
                data.meals.forEach(meal => {
                    html += `
                        <div class="card meal-card mb-3">
                            <div class="card-body">
                                <div class="d-flex justify-content-between mb-2">
                                    <div>
                                        <strong>${meal.date}</strong> -
                                        <span class="badge bg-secondary">${meal.meal_type}</span>
                                    </div>
                                    <span class="badge bg-primary">${meal.totalCalories} cal</span>
                                </div>
                                <div><em>${meal.meal_name}</em></div>
                                ${meal.photo_url ? `<img src="${meal.photo_url}" class="meal-photo" alt="Meal photo">` : ''}
                                <div class="mt-2">
                    `;

                    meal.foods.forEach(food => {
                        html += `
                            <div class="food-item">
                                <span>${food.food_name}</span>
                                <span class="float-end text-muted">${food.calories} cal</span>
                            </div>
                        `;
                    });

                    html += `
                                </div>
                            </div>
                        </div>
                    `;
                });
            }

            document.getElementById('historyResult').innerHTML = html;
        }
    } catch (error) {
        document.getElementById('historyResult').innerHTML =
            `<div class="alert alert-danger">❌ Failed to load history: ${error.message}</div>`;
    } finally {
        toggleSpinner('historySpinner', false);
    }
}

// Load leaderboard function
async function loadLeaderboard() {
    const limit = document.getElementById('leaderboardLimit').value || 10;

    toggleSpinner('leaderboardSpinner', true);
    document.getElementById('leaderboardResult').innerHTML = '';

    try {
        const result = await apiCall('GET', `/leaderboard?limit=${limit}`);

        if (result.success) {
            const data = result.data;

            let html = `
                <h6>${data.eventName}</h6>
                <p class="text-muted">${data.eventDates.start} to ${data.eventDates.end}</p>
            `;

            if (data.yourRank) {
                html += `<p><strong>Your Rank: #${data.yourRank}</strong></p>`;
            }

            if (data.leaderboard.length === 0) {
                html += '<p class="text-muted">No participants in this event.</p>';
            } else {
                html += `
                    <table class="table table-striped">
                        <thead>
                            <tr>
                                <th>Rank</th>
                                <th>Username</th>
                                <th>Success Rate</th>
                                <th>Days On Track</th>
                                <th>Avg Daily</th>
                            </tr>
                        </thead>
                        <tbody>
                `;

                data.leaderboard.forEach(entry => {
                    const medal = entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : '';
                    html += `
                        <tr>
                            <td>${medal} ${entry.rank}</td>
                            <td>${entry.username}</td>
                            <td><span class="badge bg-success">${entry.success_rate}%</span></td>
                            <td>${entry.days_on_track}</td>
                            <td>${entry.avg_daily} cal</td>
                        </tr>
                    `;
                });

                html += `
                        </tbody>
                    </table>
                `;
            }

            document.getElementById('leaderboardResult').innerHTML = html;
        }
    } catch (error) {
        document.getElementById('leaderboardResult').innerHTML =
            `<div class="alert alert-danger">❌ Failed to load leaderboard: ${error.message}</div>`;
    } finally {
        toggleSpinner('leaderboardSpinner', false);
    }
}
