const mongoose = require("mongoose");
const sha256 = require('crypto-js/sha256');
const Product = mongoose.model('Product');

// const productSchema = new mongoose.Schema({
//     id: String,
//     type:String,
//     name: String,
//     price: String
// });
const items = [
    {   
        type: 'Rice',
        name: 'Premium Japanese Rice',
        priceInCents: 100
    },
    {   
        type: 'Rice',
        name: 'Fried Rice',
        priceInCents: 250
    },
    {   
        type: 'Noodles',
        name: 'Mee Goreng',
        priceInCents: 100
    },
    {   
        type: 'Appetizer',
        name: 'Smoked Salmon Sandwich',
        priceInCents: 100
    }
]

items.map((item,idx)=> {
    return item.id = sha256(((idx+1)*100).toString() + item.type.slice(0,3)).toString()
})

items.forEach((item) => {
    Product.findOne({ name:item.name }, (err,item) => {
        // if Product is not found
        if(err){
            const newProduct = new Product({
                id: item.id,
                type: item.type,
                name: item.name,
                priceInCents: item.priceInCents
            });

            newProduct.save()
            .then((product)=>{
                console.log(`Successfully saved ${product.name}`);
            })
            .catch(err => console.error(err))
        }else{
            // console.log(item.id);
        }
    })
})