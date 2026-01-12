// --- HELPER: CONSTRUCT IMAGE URL ---
const getImageUrl = (blobName) => {
    return `https://blobcookbook.blob.core.windows.net/cookbook-media/${blobName}`;
};

// --- HELPER: DECODE AZURE COSMOS DATA ---
const decodeCosmosData = (data) => {
    if (Array.isArray(data) && data[0] && data[0]['$content']) {
        const base64Content = data[0]['$content'];
        const decodedString = atob(base64Content);
        return JSON.parse(decodedString);
    }
    return data;
};

// --- API FUNCTIONS ---
async function getAllRecipes() {
    const response = await fetch(API.GET_ALL_URL);
    const data = await response.json();
    return data.Documents || []; 
}

async function getRecipeById(id) {
    const url = API.GET_BY_ID_URL.replace('%7Bid%7D', id);
    const response = await fetch(url);
    return await response.json();
}

async function updateRecipe(id, recipeObject) {
    const url = API.UPDATE_URL.replace('%7Bid%7D', id);
    const response = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(recipeObject)
    });
    return await response.json();
}

async function deleteRecipe(id, partitionKey) {
    const url = API.DELETE_URL.replace('%7Bid%7D', id); 
    const response = await fetch(url, {
        method: 'POST',
        headers: { 
            'pk': partitionKey
        }
    });
    return await response.text();
}

// --- UI HANDLERS ---
async function handleDelete(id, pk) {
    if (confirm(`Are you sure you want to delete recipe ${id}?`)) {
        const res = await deleteRecipe(id, pk);
        alert(res);
        loadRecipes();
    }
}

async function handleEdit(id) {
    window.location.href = `create.html?edit=${id}`;
}

// --- RENDER LOGIC ---
async function loadRecipes() {
    const recipesContainer = document.getElementById('recipes');
    recipesContainer.innerHTML = '<div style="text-align: center; color: #667eea; font-size: 18px;">Loading recipes...</div>';
    
    const recipes = await getAllRecipes();
    
    recipesContainer.innerHTML = recipes.map(recipe => {
        let imgSrc = 'https://placehold.co/150/667eea/ffffff?text=No+Image';
        
        if (recipe.media) {
            if (recipe.media.blobName) {
                imgSrc = getImageUrl(recipe.media.blobName);
            } else if (recipe.media.url) {
                imgSrc = recipe.media.url;
            } else if (typeof recipe.media === 'string') {
                imgSrc = getImageUrl(recipe.media);
            }
        }
        
        return `
            <div class="recipe-card" style="border: 1px solid #ddd; margin: 15px 0; padding: 15px; border-radius: 10px; display: flex; gap: 20px; align-items: center;">
                <img src="${imgSrc}" 
                     alt="${recipe.title}" 
                     style="width: 120px; height: 120px; object-fit: cover; border-radius: 8px;" 
                     onerror="this.src='https://placehold.co/150/eeeeee/999999?text=Error'">
                <div style="flex-grow: 1;">
                    <h3 style="margin-top: 0;">${recipe.title}</h3>
                    <p>${recipe.description}</p>
                    <small style="color: #95a5a6; font-size: 12px;">ID: ${recipe.id}</small>
                </div>
                <div style="display: flex; flex-direction: column; gap: 8px;">
                    <button onclick="handleEdit('${recipe.id}')" style="background: linear-gradient(135deg, #3498db 0%, #2980b9 100%); color: white; border: none; padding: 8px; border-radius: 4px; cursor: pointer;">✏️ Edit</button>
                    <button onclick="handleDelete('${recipe.id}', '${recipe.pk}')" style="background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%); color: white; border: none; padding: 8px; border-radius: 4px; cursor: pointer;">🗑️ Delete</button>
                </div>
            </div>
        `;
    }).join('');
}

// --- SEARCH FUNCTIONS ---
function clearSearch() {
    document.getElementById('searchInput').value = '';
    document.getElementById('recipeResults').innerHTML = '';
}

async function triggerSearch() {
    const searchTerm = document.getElementById('searchInput').value;
    if (!searchTerm.trim()) return;
    
    const resultsDiv = document.getElementById('recipeResults');
    resultsDiv.innerHTML = '<div style="text-align: center; color: #667eea; font-size: 18px;">Searching...</div>';

    try {
        const searchUrl = `${API.SEARCH_LOGIC_APP_URL}&q=${encodeURIComponent(searchTerm)}`;
        console.log('Search URL:', searchUrl);
        
        const response = await fetch(searchUrl);
        console.log('Search response status:', response.status);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.log('Error response:', errorText);
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('Search response data:', data);
        
        const recipes = data.Documents || data.value || data || [];
        
        if (recipes.length === 0) {
            resultsDiv.innerHTML = '<div style="text-align: center; color: #95a5a6;">No recipes found</div>';
            return;
        }
        
        resultsDiv.innerHTML = recipes.map(recipe => {
            let imgSrc = 'https://placehold.co/150/667eea/ffffff?text=No+Image';
            
            if (recipe.media) {
                if (recipe.media.blobName) {
                    imgSrc = getImageUrl(recipe.media.blobName);
                } else if (recipe.media.url) {
                    imgSrc = recipe.media.url;
                } else if (typeof recipe.media === 'string') {
                    imgSrc = getImageUrl(recipe.media);
                }
            }
            
            return `
                <div class="recipe-card" style="border: 1px solid #ddd; margin: 15px 0; padding: 15px; border-radius: 10px; display: flex; gap: 20px; align-items: center;">
                    <img src="${imgSrc}" 
                         alt="${recipe.title}" 
                         style="width: 120px; height: 120px; object-fit: cover; border-radius: 8px;" 
                         onerror="this.src='https://placehold.co/150/eeeeee/999999?text=Error'">
                    <div style="flex-grow: 1;">
                        <h3 style="margin-top: 0;">${recipe.title}</h3>
                        <p>${recipe.description}</p>
                        <small style="color: #95a5a6; font-size: 12px;">ID: ${recipe.id}</small>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 8px;">
                        <button onclick="handleEdit('${recipe.id}')" style="background: linear-gradient(135deg, #3498db 0%, #2980b9 100%); color: white; border: none; padding: 8px; border-radius: 4px; cursor: pointer;">✏️ Edit</button>
                        <button onclick="handleDelete('${recipe.id}', '${recipe.pk}')" style="background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%); color: white; border: none; padding: 8px; border-radius: 4px; cursor: pointer;">🗑️ Delete</button>
                    </div>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error("Search failed:", error);
        resultsDiv.innerHTML = `<div style="text-align: center; color: #e74c3c;">Search failed: ${error.message}</div>`;
    }
}

// Initial Load
window.onload = () => {
    loadRecipes();
};