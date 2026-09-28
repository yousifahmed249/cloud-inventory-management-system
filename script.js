function addProduct() {
    const name = document.getElementById("productName").value;
    const quantity = document.getElementById("quantity").value;
    const price = document.getElementById("price").value;

    if (name === "" || quantity === "" || price === "") {
        alert("Please fill all fields");
        return;
    }

    const table = document.getElementById("productTable");

    const row = table.insertRow();

    let status;

    if (quantity == 0) {
        status = "🔴 Out of Stock";
    } else if (quantity <= 5) {
        status = "🟡 Low Stock";
    } else {
        status = "🟢 Stock Available";
    }

    row.innerHTML = `
        <td>${name}</td>
        <td>${quantity}</td>
        <td>${price}</td>
        <td>${status}</td>
        <td>
            <button onclick="deleteProduct(this)">Delete</button>
        </td>
    `;

    document.getElementById("productName").value = "";
    document.getElementById("quantity").value = "";
    document.getElementById("price").value = "";
}

function deleteProduct(button) {
    button.parentElement.parentElement.remove();
}