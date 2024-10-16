/**
 * This file is loaded via the <script> tag in the index.html file and will
 * be executed in the renderer process for that window. No Node.js APIs are
 * available in this process because `nodeIntegration` is turned off and
 * `contextIsolation` is turned on. Use the contextBridge API in `preload.js`
 * to expose Node.js functionality from the main process.
 */

(async () => {

    if (!localStorage.getItem('token')) {
        alert("You are not logged in")
        window.location.href = "./index.html";
    }
    
    const API_URL = 'https://virtualboard-api-h3bgghaga9f2ctg0.northeurope-01.azurewebsites.net' /*"http://localhost:8080"*/
    
    document.querySelector('#user').innerHTML = getUserName();
    
    // Decode Jwt for username ChatGPT helped me with this
    function getUserName() {
        const jwt_token = localStorage.getItem('token');
        const [header, payload, signature] = jwt_token.split('.');
        const decodedHeader = JSON.parse(atob(header));
        const decodedPayload = JSON.parse(atob(payload));
        return decodedPayload.name;
    }
    
    const themes = [
        { background: 'linear-gradient(to right, #2193b0, #6dd5ed)', text: '#6dd5ed' },
        { background: 'linear-gradient(to right, #cc2b5e, #753a88)', text: '#753a88' },
        { background: 'linear-gradient(to right, #42275a, #734b6d)', text: '#734b6d' },
        { background: 'linear-gradient(to right, #000428, #004e92)', text: '#004e92' },
        { background: 'linear-gradient(to right, #ffafbd, #ffc3a0)', text: '#ffc3a0' },
    
    ];
    
    let currentThemeIndex = 0;
    
    function toggleTheme() {
        const cardElement = document.querySelector('.canvas');
        cardElement.style.background = '';
        currentThemeIndex = (currentThemeIndex + 1) % themes.length;
        cardElement.style.background = themes[currentThemeIndex].background;
        cardElement.style.color = themes[currentThemeIndex].text;
    }
    
    //let boards = []; 
    
    // Function to fetch boards from the backend
    function updateBoardsSelector(boards) {
        const selector = document.getElementById('boards-selector');
        selector.innerHTML = '';
        boards.forEach(board => {
            const option = document.createElement('option');
            option.value = board.id;
            option.textContent = board.title;
            selector.appendChild(option);
        });
    
        if (boards.length > 0) {
            selector.value = boards[0].id;
            displayBoardCards(boards[0].cards);
        }
    
        const boardName = document.getElementById('boards-selector').options[selector.selectedIndex].text;
        const startBoard = document.getElementById('boards-selector').value;
        // WebSocket connection
        connectWebSocket(startBoard, boardName, boards[0].cards);
    }
    
    // Function to create a new board
    async function createBoard() {
        const title = prompt("Enter board title:");
        const content = prompt("Enter board content:");
    
        const boardData = {
            title: title,
            content: content,
        };
    
        const token = localStorage.getItem('token');
    
        try {
            const response = await fetch(`${API_URL}/boards`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify(boardData),
            });
    
            if (!response.ok) {
                const errorResponse = await response.json();
                throw new Error(`HTTP error! Status: ${response.status}, Message: ${errorResponse.msg || "Unknown error"}`);
            }
    
            const newBoard = await response.json();
            //console.log("Board created:", newBoard);
    
        } catch (error) {
            console.error("Error creating board:", error);
        }
    }
    
    
    
    // Function to create a new card
    async function createCard() {
        const boardId = document.getElementById('boards-selector').value;
        const title = document.getElementById('new-card-name').value;
        const content = document.getElementById('content').value;
    
        //console.log("BoardId: " + boardId)
    
        const cardData = {
            title: title,
            content: content,
            xPosition: String(window.innerWidth / 2),
            yPosition: String(window.innerHeight / 2),
        };
    
        const token = localStorage.getItem('token');
    
        try {
            const response = await fetch(`${API_URL}/boards/${boardId}/cards`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify(cardData),
            });
    
            if (!response.ok) {
                const errorResponse = await response.json();
                throw new Error(`HTTP error! Status: ${response.status}, Message: ${errorResponse.msg || "Unknown error"}`);
            }
    
            const newCard = await response.json();
            //console.log("Card created:", newCard);
    
            const selectedBoard = boards.find(board => board.id === boardId);
            if (selectedBoard) {
                selectedBoard.cards.push(newCard);
                displayBoardCards(selectedBoard.cards);
            }
    
            // Send new card to other clients
            if (socket && socket.readyState === WebSocket.OPEN) {
                newCard.type = 'createCard';
                socket.send(JSON.stringify(newCard));
            }
            // Send to other clients
            sendToClients(selectedBoard.cards, boardId)
    
            hideCardModal();
        } catch (error) {
            console.error("Error creating card:", error);
        }
    }
    
    async function editCard(cardId) {
        const titleElement = document.getElementById(`title-${cardId}`);
        const contentElement = document.getElementById(`content-${cardId}`);
    
        if (!titleElement || !contentElement) {
            console.error(`Card elements with ID ${cardId} not found.`);
            return;
        }
    
        const updateCardContent = async () => {
            const newTitle = titleElement.innerText;
            const newContent = contentElement.value;
    
            const token = localStorage.getItem('token');
            const boardId = document.getElementById('boards-selector').value;
    
            const updatedCardData = {
                title: newTitle,
                content: newContent
            };
    
            try {
                const response = await fetch(`${API_URL}/boards/${boardId}/cards/${cardId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`,
                    },
                    body: JSON.stringify(updatedCardData),
                });
    
                if (!response.ok) {
                    const errorResponse = await response.json();
                    throw new Error(`HTTP error! Status: ${response.status}, Message: ${errorResponse.msg || "Unknown error"}`);
                }
    
                //console.log("Card updated:", { id: cardId, title: newTitle, content: newContent });
    
            } catch (error) {
                console.error("Error updating card:", error);
            }
        };
    
        titleElement.addEventListener('blur', updateCardContent);
        contentElement.addEventListener('blur', updateCardContent);
    }
    
    async function fetchBoards() {
        const token = localStorage.getItem('token');
    
        try {
            const response = await fetch(`${API_URL}/boards`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });
    
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
    
            const data = await response.json();
            //console.log("Boards fetched:", data);
            boards = data.boards;
            //console.log("Boards array:", boards);
            const selectedBoardId = document.getElementById('boards-selector').value;
            updateBoardsSelector(boards);
            loadCardPositions(selectedBoardId);
    
        } catch (error) {
            console.error("Error fetching boards:", error);
        }
    }
    
    
    async function displayBoardCards(cards, boardId) {
        const cardContainer = document.getElementById('cards-container');
        
        cardContainer.style.display = 'none';
        cardContainer.innerHTML = '';
    
        if (cards.length === 0) {
            cardContainer.innerHTML = '<p>No cards available for this board.</p>';
            return;
        }
    
        cards.forEach(card => {
            const cardElement = document.createElement('div');
            cardElement.setAttribute('id', card.id);
            cardElement.classList.add('bg-white', 'shadow-md', 'rounded-lg', 'p-4', 'mb-4', 'inline-block', 'm-3');
            cardElement.setAttribute('draggable', 'false');
    
            cardElement.innerHTML = `
                <h3 class="text-lg font-bold" contenteditable="true" id="title-${card.id}">${card.title || 'Untitled'}</h3>
                <textarea class="text-gray-600" contenteditable="true" rows='4' placeholder='Type your note or text here...' id="content-${card.id}">${card.content || 'No content'}</textarea>
                <button onclick="deleteCard('${card.id}')">🗑️</button>
            `;
    
    
            //Chatgpt hjälpte med drag funktionalitet
            let isDragging = false;
            let startX, startY, initialMouseX, initialMouseY;
    
            cardElement.addEventListener('mousedown', (event) => {
                const isEditableElement = event.target.closest('[contenteditable="true"]');
                if (isEditableElement) {
                    editCard(card.id);
                    return;
                }
    
                isDragging = false;
                startX = cardElement.offsetLeft;
                startY = cardElement.offsetTop;
                initialMouseX = event.clientX;
                initialMouseY = event.clientY;
    
                let dx;
                let dy;
    
                const onMouseMove = (moveEvent) => {
                    isDragging = true;
                    dx = moveEvent.clientX - initialMouseX;
                    dy = moveEvent.clientY - initialMouseY;
    
                    cardElement.style.position = 'absolute';
                    cardElement.style.left = `${startX + dx}px`;
                    cardElement.style.top = `${startY + dy}px`;
                    event.preventDefault();
                };
    
                const onMouseUp = () => {
                    document.removeEventListener('mousemove', onMouseMove);
                    document.removeEventListener('mouseup', onMouseUp);
                    if (isDragging) {
                        saveCardPositions(boardId);
                    }
                    isDragging = false;
    
                    if (socket && socket.readyState === WebSocket.OPEN) {
                        const cardPos = document.getElementById(card.id);
                        const { left, top } = cardPos.getBoundingClientRect();
                        const containerRect = document.getElementById('cards-container').getBoundingClientRect();
    
                        const relativeLeft = left - containerRect.left;
                        const relativeTop = top - containerRect.top;
    
                        const updateCardPos = JSON.stringify({
                            type: "moveCard",
                            id: card.id,
                            boardId: boardId,
                            xPos: relativeLeft,
                            yPos: relativeTop
                        });
                        socket.send(updateCardPos);
                    }
                };
    
                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
            });
    
            cardContainer.appendChild(cardElement);
        });
    
        await loadCardPositions(boardId);
        cardContainer.style.display = 'block';
    }
    
    async function saveCardPositions() {
        const boardId = document.getElementById('boards-selector').value;
        const token = localStorage.getItem('token');
    
        if (!token) {
            console.error('Token is undefined. Please log in.');
            return;
        }
    
        const cards = document.querySelectorAll('#cards-container > div');
        //Chatgpt hjälpte med att få card positions
        for (const card of cards) {
            const cardId = card.id;
            const { left, top } = card.getBoundingClientRect();
            const containerRect = document.getElementById('cards-container').getBoundingClientRect();
    
            const relativeLeft = left - containerRect.left;
            const relativeTop = top - containerRect.top;
    
            const cardPosition = {
                id: cardId,
                boardId: boardId,
                xPosition: String(relativeLeft),
                yPosition: String(relativeTop)
            };
    
            try {
                const response = await fetch(`${API_URL}/boards/${boardId}/cards/${cardId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`,
                    },
                    body: JSON.stringify(cardPosition)
                });
    
                if (response.ok) {
                    //console.log(cardPosition)
                    //console.log(`Card position for ID ${cardId} saved successfully!`);
                } else {
                    const errorData = await response.json();
                    console.error(`Failed to save card position for ID ${cardId}:`, errorData);
                }
            } catch (error) {
                console.error(`Error saving card position for ID ${cardId}:`, error);
            }
        }
    }
    
    
    
    async function loadCardPositions() {
        const token = localStorage.getItem('token');
        try {
            const response = await fetch(`${API_URL}/boards`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                }
            });
    
            if (response.ok) {
                const data = await response.json();
    
                data.boards.forEach(board => {
                    const cards = board.cards;
    
                    cards.forEach(({ id, xPosition, yPosition }) => {
                        const card = document.getElementById(id);
                        if (card) {
                            card.style.position = 'absolute';
                            card.style.left = `${parseFloat(xPosition)}px`;
                            card.style.top = `${parseFloat(yPosition)}px`;
                        }
                    });
                });
            } else {
                const errorData = await response.json();
                console.error('Failed to load card positions:', errorData);
            }
        } catch (error) {
            console.error('Error loading card positions:', error);
        }
    }
    
    const WS_TOKEN = localStorage.getItem('token');
    //const WS_URL = 'wss://virtualboard-ws.azurewebsites.net' //"ws://localhost:8081"
    const WS_URL = "wss://wom24-ws-pastebin.azurewebsites.net";
    
    let socket;
    
    function connectWebSocket(boardId, name, cards) {
    
        // ChatGPT helped me build parts of the WebSocket function but not the entire function
        // Checks if the user already has a connection to a board and if it has then remove it
        if (socket) {
            //console.log('Closing existing WebSocket connection');
            socket.close();  // Close the existing connection before opening a new one
        }
    
        //console.log('Selected Board ID:', boardId);
        //console.log(`${WS_URL}?token=${WS_TOKEN}&board_id=${boardId}`)
    
        // Main socket instance
        socket = new WebSocket(`${WS_URL}?token=${WS_TOKEN}&board_id=${boardId}`)
    
        socket.onopen = function (event) {
            //console.log(`Connected to WebSocket server on board id: ${boardId} Name: ${name}`);
            document.getElementById('ws-conn').innerHTML = 'Connected'
            document.querySelector("#websocket-test").innerText = `Connected to WebSocket Server on board ${name}!`;
        };
    
        // WS message, updates the users page with new data
        socket.onmessage = function (event) {
    
            try {
                // Try to parse the JSON
                const data = JSON.parse(event.data);
    
                // ChatGPT Helped me to use the type to check for what is being sent to handle different data
                if (data.type === "updateCard") {
                    document.querySelector('#websocket-conn').innerHTML = `Connected on board ${name}`;
                    document.getElementById(`content-${data.cardId}`).value = data.content;
                    const selectedBoard = boards.find(board => board.id === boardId);
                    const cardToUpdate = selectedBoard.cards.find(card2 => card2.id === data.cardId);
                    if (cardToUpdate) {
                        cardToUpdate.content = data.content;
                    }
    
                } else if (data.type === "createCard") {
    
                    const selectedBoard = boards.find(board => board.id === data.boardId);
                    const selectedBoard2 = boards.find(board => board.id === boardId);
                    // Update view if the created card is on the same board as the client
                    if (data.boardId == boardId) {
                        updateClientCards(data);
                    }
    
                    if (selectedBoard) {
                        // Check if the card already exists
                        const existingCardIndex = selectedBoard.cards.findIndex(card => card.id === data.id);
                        if (existingCardIndex === -1) {
                            // If the card does not exist, add it to the cards array
                            selectedBoard.cards.push(data);
                        }
                        if (data.boardId != boardId) {
                            sendToClients(selectedBoard2.cards, boardId);
                        } else {
                            sendToClients(selectedBoard.cards, data.boardId);
                        }
                    }
                
                } else if (data.type === "deleteCard") {
    
                    const selectedBoard = boards.find(board => board.id === data.boardId);
                    const selectedBoard2 = boards.find(board => board.id === boardId);
                    // Update view if the created card is on the same board as the client
                    if (data.boardId == boardId) {
                        removeCardFromClients(data);
                    }
                    if (selectedBoard) {
                        const cardToBeDeleted = selectedBoard.cards.find(card => card.id === data.id);
                        const index = selectedBoard.cards.indexOf(cardToBeDeleted);
                        if (index > -1) {
                            selectedBoard.cards.splice(index, 1);
                        }
                        if (data.boardId != boardId) {
                            sendToClients(selectedBoard2.cards, boardId);
                        } else {
                            sendToClients(selectedBoard.cards, data.boardId);
                        }
                    }
                } else if (data.type === 'moveCard') {
    
                    updateCardPositions(data);
                }
                else {
                    document.querySelector('#websocket-conn').innerHTML = "Not Connected";
                }
    
            } catch (error) {
                // Handle JSON parsing errors
                console.error("Error parsing JSON:", error, "Message data:", event.data);
                document.querySelector('#websocket-conn').innerHTML = "Received invalid JSON";
            }
        };
    
        // Closes WS connection
        socket.onclose = function (event) {
            //console.log('Connection Closed');
            document.getElementById('ws-conn').innerHTML = 'Not connected'
            document.querySelector("#websocket-test").innerText = "Disconnected from WebSocket Server!";
            
        }
        // Send to other clients
        sendToClients(cards, boardId)
    }
    
    function updateClientCards(newCard) {
        const boardId = newCard.boardId;
        delete newCard.boardId;
        const selectedBoard = boards.find(board => board.id === boardId);
    
        if (selectedBoard) {
            const existingCard = selectedBoard.cards.find(card => card.id === newCard.id);
            if (!existingCard) {
                selectedBoard.cards.push(newCard);
                const cardToUpdate = selectedBoard.cards.find(card2 => card2.id === newCard.id);
                if (cardToUpdate) {
                    cardToUpdate.content = newCard.content;
                }
                displayBoardCards(selectedBoard.cards);
            }
        }
    }
    
    function removeCardFromClients(removedCard) {
    
        const boardId = removedCard.boardId;
        const selectedBoard = boards.find(board => board.id === boardId);
    
        if (selectedBoard) {
            const cardToBeDeleted = selectedBoard.cards.find(card => card.id === removedCard.id);
            const index = selectedBoard.cards.indexOf(cardToBeDeleted);
            if (index > -1) {
                selectedBoard.cards.splice(index, 1);
                displayBoardCards(selectedBoard.cards);
            }
        }
    }
    
    function updateCardPositions(card) {
        const cardElement = document.getElementById(card.id)
        if (cardElement) {
            cardElement.style.position = 'absolute';
            cardElement.style.left = `${parseFloat(card.xPos)}px`;
            cardElement.style.top = `${parseFloat(card.yPos)}px`;
        }
    }
    
    function sendToClients(cards, boardId) {
    
        const selectedBoard = boards.find(board => board.id === boardId);
    
        let cardIds = [];
        cards.forEach((card) => {
            cardIds.push(card.id);
            document.getElementById(`content-${card.id}`).addEventListener('input', (evt) => {
    
                const wsData = {
                    type: "updateCard",
                    status: 0,
                    content: evt.target.value,
                    cardId: card.id
                }
                const cardToUpdate = selectedBoard.cards.find(card2 => card2.id === card.id);
                if (cardToUpdate) {
                    cardToUpdate.content = evt.target.value;
                }
                const serializedData = JSON.stringify(wsData);
                socket.send(serializedData);
            })
        })
    }
    
    // Work in prog....
    function reconnectWebSocket(boardId, boardName, cards) {
        console.log("Trying to connect...")
        connectWebSocket(boardId, boardName, cards);
    }
    
    document.getElementById('new-note').addEventListener('click', createBoard);
    document.getElementById('create-card-btn').addEventListener('click', createCard);
    
    //Function for deleting cards
    async function deleteCard(cardId) {
        const boardId = document.getElementById('boards-selector').value;
        const token = localStorage.getItem('token');
    
        try {
            const response = await fetch(`${API_URL}/boards/${boardId}/cards/${cardId}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
            });
            if (!response.ok) {
                throw new Error(`Error: ${response.status} ${response.statusText}`);
            }
            const result = await response.json();
            //console.log('Card deleted successfully:', result);
            const selectedBoard = boards.find(board => board.id === boardId);
            if (selectedBoard) {
                selectedBoard.cards = selectedBoard.cards.filter(card => card.id !== cardId);
                displayBoardCards(selectedBoard.cards);
            }
    
            // WS Delete
            const deletedCard = {
                type: 'deleteCard',
                id: cardId,
                boardId: boardId
            }
    
            // Send info on which card i deleted
            if (socket && socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify(deletedCard));
            }
    
            sendToClients(selectedBoard.cards, boardId)
        } catch (error) {
            console.error('Failed to delete card:', error);
        }
    }
    
    function openCardModal() {
        const cardModal = document.getElementById('card-modal');
        cardModal.classList.remove('hidden');
        cardModal.style.zIndex = '1000';
        const cardsToMoveBehind = document.querySelectorAll(".onClickHideCard");
    
        cardsToMoveBehind.forEach(card => {
            card.style.zIndex = '0';
        });
    }
    
    function hideCardModal() {
        const cardModal = document.getElementById('card-modal');
        cardModal.classList.add('hidden');
    }
    
    document.getElementById('open-card-modal').addEventListener('click', openCardModal);
    document.getElementById('create-card-btn').addEventListener('click', hideCardModal);
    document.getElementById('cancel-card-btn').addEventListener('click', hideCardModal);
    
    // Change websocket to connect to chosen board
    document.getElementById('boards-selector').addEventListener('change', (event) => {
        const selectedBoardId = event.target.value;
        const boardName = event.target.options[event.target.selectedIndex].text;
        //console.log(`Current board: ${selectedBoardId} Name: ${boardName}`);
        const selectedBoard = boards.find(board => String(board.id) === String(selectedBoardId));
        displayBoardCards(selectedBoard.cards);
        connectWebSocket(selectedBoardId, boardName, selectedBoard.cards);
    });
    
    fetchBoards();

})()




