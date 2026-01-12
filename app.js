// --- HELPER: CONSTRUCT IMAGE URL ---
const getImageUrl = (blobName) => {
    // UPDATED: Matches your actual storage account name 'blobcookbook'
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

async function createRecipe(formData) {
    const response = await fetch(API.CREATE_URL, {
        method: 'POST',
        body: formData 
    });
    return await response.text();
}

async function getAllRecipes() {
    const response = await fetch(API.GET_ALL_URL);
    const data = await response.json();
    // Logic App returns documents inside a 'Documents' array
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
        method: 'POST', // Logic App trigger is set to POST
        headers: { 
            'pk': partitionKey // Required by your Logic App header check
        }
    });
    return await response.text();
}

// --- UI HANDLERS ---

let isEditMode = false;
let editingRecipeId = null;

const createForm = document.getElementById('createForm');

createForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (isEditMode) {
        // ... (Keep your existing Update logic)
    } else {
        // Handle create
        const formData = new FormData(createForm);
        
        const fileInput = createForm.querySelector('input[type="file"]');
        if(fileInput.files[0]) {
            // This MUST match @triggerFormDataValue('FileName') in your Logic App
            formData.append('FileName', fileInput.files[0].name);
        }

        try {
            const res = await createRecipe(formData);
            document.getElementById('createResult').innerText = res;
            createForm.reset();
            loadRecipes();
        } catch (err) {
            console.error("Upload failed:", err);
            document.getElementById('createResult').innerText = "Upload failed. Check console.";
        }
    }
});

function resetForm() {
    isEditMode = false;
    editingRecipeId = null;
    window.currentRecipeMedia = null;
    window.currentRecipeCreatedAt = null;
    createForm.reset();
    const btn = createForm.querySelector('button');
    btn.innerText = '📤 Upload';
    document.getElementById('createResult').innerText = '';
    
    const cancelBtn = document.getElementById('cancelEdit');
    if (cancelBtn) cancelBtn.style.display = 'none';
}

async function handleDelete(id, pk) {
    if (confirm(`Are you sure you want to delete recipe ${id}?`)) {
        const res = await deleteRecipe(id, pk);
        alert(res);
        loadRecipes();
    }
}

async function handleEdit(id) {
    const recipe = await getRecipeById(id);
    if (!recipe) return;

    isEditMode = true;
    editingRecipeId = recipe.id;
    window.currentRecipeMedia = recipe.media;
    window.currentRecipeCreatedAt = recipe.createdAt;

    const ingredients = decodeCosmosData(recipe.ingredients || []);
    const steps = decodeCosmosData(recipe.steps || []);

    const form = document.getElementById('createForm');
    form.pk.value = recipe.pk || '';
    form.title.value = recipe.title || '';
    form.description.value = recipe.description || '';
    form.ingredients.value = JSON.stringify(ingredients);
    form.steps.value = JSON.stringify(steps);
    
    const btn = form.querySelector('button');
    btn.innerText = '💾 Save Changes';
    
    let cancelBtn = document.getElementById('cancelEdit');
    if (!cancelBtn) {
        cancelBtn = document.createElement('button');
        cancelBtn.id = 'cancelEdit';
        cancelBtn.type = 'button';
        cancelBtn.innerText = '✖️ Cancel';
        cancelBtn.style.marginLeft = '10px';
        cancelBtn.onclick = resetForm;
        btn.parentNode.insertBefore(cancelBtn, btn.nextSibling);
    }
    cancelBtn.style.display = 'inline-block';
    form.scrollIntoView({ behavior: 'smooth' });
}

// --- 4. Render Logic ---
async function loadRecipes() {
    const recipesContainer = document.getElementById('recipes');
    recipesContainer.innerHTML = '<div style="text-align: center; color: #667eea; font-size: 18px;">Loading recipes...</div>';
    
    const recipes = await getAllRecipes();
    
    recipesContainer.innerHTML = recipes.map(recipe => {
        // Fallback image if nothing is found
        let imgSrc = 'https://placehold.co/150/667eea/ffffff?text=No+Image';
        
        // This logic ensures we use the numeric ID name seen in your screenshot
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

// Initial Load
window.onload = () => {
    loadRecipes();
    const cancelBtn = document.getElementById('cancelEdit');
    if (cancelBtn) cancelBtn.style.display = 'none';
};

async function triggerSearch() {
    const searchTerm = document.getElementById('searchInput').value;
    // Replace with your Logic App URL from the trigger
    const logicAppUrl = "SEARCH_LOGIC_APP_URL"; 

    try {
        const response = await fetch(`${logicAppUrl}&q=${encodeURIComponent(searchTerm)}`);
        const data = await response.json();
        
        const resultsDiv = document.getElementById('recipeResults');
        resultsDiv.innerHTML = data.value.map(recipe => `
            <div class="recipe-card">
                <h3>${recipe.title}</h3>
                <p>${recipe.description}</p>
                <div class="ai-tags">
                    ${recipe.ai_tag_names.map(tag => `<span class="tag-pill">${tag}</span>`).join('')}
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error("Search failed:", error);
    }
}