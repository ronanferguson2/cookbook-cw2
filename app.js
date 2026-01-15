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
        const updatedDoc = {
            id: editingRecipeId,
            pk: createForm.pk.value,
            title: createForm.title.value,
            description: createForm.description.value,
            ingredients: JSON.parse(createForm.ingredients.value),
            steps: JSON.parse(createForm.steps.value),
            media: window.currentRecipeMedia,
            createdAt: window.currentRecipeCreatedAt
        };
        await updateRecipe(editingRecipeId, updatedDoc);
        resetForm();
        loadRecipes();
        document.getElementById('createResult').innerText = 'Recipe updated successfully!';
    } else {
        const formData = new FormData();
        
        // Add fields in order: pk, title, description, ingredients, steps, File (index 5)
        formData.append('pk', createForm.pk.value);
        formData.append('title', createForm.title.value);
        formData.append('description', createForm.description.value);
        formData.append('ingredients', createForm.ingredients.value);
        formData.append('steps', createForm.steps.value);
        
        const fileInput = createForm.querySelector('input[type="file"]');
        if(fileInput.files[0]) {
            formData.append('File', fileInput.files[0]);
        }

        try {
            const res = await createRecipe(formData);
            document.getElementById('createResult').innerText = res;
            createForm.reset();
            loadRecipes();
        } catch (err) {
            console.error("Upload failed:", err);
            document.getElementById('createResult').innerText = "Upload failed.";
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
        // Decode media if it's wrapped in Cosmos encoding
        const media = decodeCosmosData(recipe.media);
        
        let imgSrc = 'https://placehold.co/150/667eea/ffffff?text=No+Image';
        
        if (media?.fullUrl) {
            imgSrc = media.fullUrl;
        } else if (media?.blobName) {
            imgSrc = getImageUrl(media.blobName);
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
        const response = await fetch(`${API.SEARCH_LOGIC_APP_URL}&q=${encodeURIComponent(searchTerm)}`);
        const data = await response.json();
        console.log('Search response:', data);
        
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
        resultsDiv.innerHTML = '<div style="text-align: center; color: #e74c3c;">Search failed. Check console for details.</div>';
    }
}