// thankyou.js
document.addEventListener('DOMContentLoaded', async () => {
    console.log("🚀 thankyou.html LOADED - Starting verification...");

    const spinner = document.getElementById('spinner');
    const messageEl = document.getElementById('message');
    const buttonsEl = document.getElementById('buttons');

    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get('session_id');
    const orderID = urlParams.get('token');
    const forceReset = urlParams.get('reset') === '1';

    console.log(`📌 sessionId: ${sessionId} | orderID: ${orderID} | forceReset: ${forceReset}`);

    // Force reset pour ce test
    if (forceReset) {
        sessionStorage.clear();
        console.log("🔄 sessionStorage cleared (forceReset)");
    }

    let payload = null;
    if (sessionId) payload = { provider: 'stripe', sessionId };
    else if (orderID) payload = { provider: 'paypal', orderID };

    if (!payload) {
        displayError("We're sorry, but we couldn't find your payment information. Please contact CurvaFit support for assistance.");
        spinner.style.display = "none";
        return;
    }

    // Vérification anti-double désactivée pour le test (on la remettra après)
    console.log("🔄 Bypassing alreadyVerified check for debugging");

    try {
        const functionUrl = `${window.location.origin}/.netlify/functions/verify-payment`;
        console.log(`📡 Calling: ${functionUrl}`);

        const response = await fetch(functionUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        console.log(`📡 Response status: ${response.status}`);

        if (response.status === 404) {
            throw new Error("We're experiencing a temporary issue with order verification. Please try again later or contact CurvaFit support.");
        }

        const data = await response.json();
        console.log("📦 Data received:", data);

        if (!response.ok || !data.success) {
            throw new Error(data.error || "There was an issue verifying your order. Please contact CurvaFit support.");
        }

        // On sauvegarde seulement après succès
        sessionStorage.setItem("paymentVerified", sessionId || orderID);

        showSuccess();
        console.log("🎉 VERIFICATION COMPLETED - Check your CJ account now!");

    } catch (error) {
        console.error("❌ ERREUR COMPLETE:", error);
        displayError(error.message || "An unexpected error occurred. Please contact CurvaFit support for help.");
    } finally {
        spinner.style.display = "none";
    }
});

function showSuccess() {
    document.getElementById('message').innerHTML = `
        <h1>Thank You for Your Order, Dear Customer!</h1>
        <p>We are delighted that you chose CurvaFit with full confidence!</p>
        <p>✅ Your order has been confirmed!</p>
        <p>Your order will arrive soon.</p>
        <p>Please check your email inbox for your order tracking number!</p>
        <p>You can reorder below and take advantage of our offers.</p>
    `;
    document.getElementById('message').style.display = 'block';
    document.getElementById('buttons').style.display = 'block';
}

function displayError(message) {
    document.getElementById('message').innerHTML = `<p class="error">${message}</p>`;
    document.getElementById('message').style.display = 'block';
    document.getElementById('buttons').style.display = 'block';
}