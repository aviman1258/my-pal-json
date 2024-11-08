import { dataStore } from './send-request.js';

document.getElementById("requestTab").addEventListener("click", function() {    
    // Switch to Request tab
    this.classList.add("active");
    document.getElementById("responseTab").classList.remove("active");

    // Show request data in inputJson
    if (dataStore.requestData) {
        document.getElementById("inputJson").value = dataStore.requestData;
    } else {
        document.getElementById("inputJson").value = "";
    }
    document.getElementById("inputJson").placeholder = "Input JSON body here";
});

document.getElementById("responseTab").addEventListener("click", function() {   
    // Switch to Response tab
    this.classList.add("active");
    document.getElementById("requestTab").classList.remove("active");

    // Show response data in inputJson
    if (dataStore.responseData) {
        document.getElementById("inputJson").value = dataStore.responseData;
    } else {
        document.getElementById("inputJson").value = "";
    }
    document.getElementById("inputJson").placeholder = "Response JSON will be displayed here";
});

// Capture request data when typing in Request mode
document.getElementById("inputJson").addEventListener("input", function() {
    if (document.getElementById("requestTab").classList.contains("active")) {
        dataStore.requestData = this.value;
    }
});
