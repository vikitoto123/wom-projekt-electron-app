/**
 * This file is loaded via the <script> tag in the index.html file and will
 * be executed in the renderer process for that window. No Node.js APIs are
 * available in this process because `nodeIntegration` is turned off and
 * `contextIsolation` is turned on. Use the contextBridge API in `preload.js`
 * to expose Node.js functionality from the main process.
 */

(async () => {

    const API_URL = 'https://virtualboard-api-h3bgghaga9f2ctg0.northeurope-01.azurewebsites.net'/* "http://localhost:8080";*/

    async function logIn(user, pass) {
        //console.log(user, pass);
    
        try {
            const response = await fetch(`${API_URL}/users/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: user,
                    password: pass
                })
            });
    
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
    
            const respData = await response.json();
            //console.log(respData);
            const jwt_token = respData.jwt;
            localStorage.setItem('token', jwt_token);
            window.location.href = './boards.html';
    
    
    
        } catch (error) {
            console.error("Error during login:", error);
            document.querySelector('#error-output').innerHTML = "Login failed";
            document.querySelector('#error-output').style.color = "red";
            document.querySelector('#error-output').style.fontWeight = 'bold';
        }
    }
    
    
    document.querySelector('#btn-login').addEventListener('click', () => {
        const user = document.querySelector('#username').value;
        const pass = document.querySelector('#password').value;
    
        if (!user) {
            document.querySelector('#error-output').innerHTML = "You have not filled in the username form! Fill it in please!";
            document.querySelector('#error-output').style.color = "red";
            document.querySelector('#error-output').style.fontWeight = 'bold';
            return;
        } else if (!pass) {
            document.querySelector('#error-output').innerHTML = "You have not filled in the password form! Fill it in please!";
            document.querySelector('#error-output').style.color = "red";
            document.querySelector('#error-output').style.fontWeight = 'bold';
            return;
        }
    
        logIn(user, pass);
    
    });

})()