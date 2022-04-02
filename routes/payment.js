const router = require('express').Router();
const utils = require('../lib/utils');
const mongoose = require("mongoose");
const Product = mongoose.model('Product');

const stripe = require('stripe')(process.env.STRIPE_PRIVATE_KEY)

const Redis = require("ioredis");
const redis = new Redis({
  port: 13821, // Redis port
  host: "redis-13821.c80.us-east-1-2.ec2.cloud.redislabs.com", // Redis host
  password: process.env.REDIS_PASSWORD, // Redis password
})
// check redis connection 
redis.ping(function (err, result) {
  if(err) console.error(err)
  else console.log("Redis status:",redis.status);
});
const DEFAULT_EXPIRATION = 60 * 5

// router.get('/test',(req,res)=>res.send("Hello world!"))
router.post('/create-checkout-session', async (req, res) => {
  // https://stackoverflow.com/questions/42489918/async-await-inside-arraymap
  // const someFunction = (myArray) => {
  //   const promises = myArray.map(async (myValue) => {
  //       return {
  //           id: "my_id",
  //           myValue: await service.getByValue(myValue)
  //       }
  //   });
  //   return Promise.all(promises);
  // }
    const checkPrice = (cartItemArray) => {
      const promises = cartItemArray.map( async(item) => {
        const productInDb = await Product.findOne({ id:item.id })
        console.log(productInDb);
        item.title = productInDb.name
        item.price = productInDb.priceInCents
      });
      return Promise.all(promises)
    }
    try {
      // Flow Control 
      console.log(req.body);
      const cartItems = req.body.cartObjects
      const { customer_id } = req.body
      
      //* 1. Check and change price to priceInCents based on item.id
      await checkPrice(cartItems); 

      //* 2. Define line_items to list cartItems on stripe payment site
      const line_items = cartItems.map((item)=>{
        const { title, quantity, price } = item
        return{
            price_data: {
              currency: 'sgd',
              product_data: {
                name: title,
              },
              unit_amount: Number(price),  //priceInCents store in DB cant mutate
            },
            quantity: Number(quantity),
        }
      }).filter((item) => item.quantity !== 0);
      
      //* 3. Config to create checkout session
      const sessionConfigWithCustomer = {
          payment_method_types: ["card"],
          mode: 'payment',
          // [{
          //   price_data: {
          //     currency: 'sgd',
          //     product_data: {
          //       name: 'Test Item',
          //     },
          //     unit_amount: 2000,  //priceInCents store in DB
          //   },
          //   quantity: 1,
          // }],
          line_items: line_items,
          success_url: `${process.env.CLIENT_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`, // {CHECKOUT_SESSION_ID} format by stripe API
          cancel_url: `${process.env.CLIENT_URL}/payment/cancel`,
          customer: customer_id,
          customer_update: {name: "auto",},
      }
      const sessionConfigWithoutCustomer = {
        payment_method_types: ["card"],
        mode: 'payment',
        line_items: line_items,
        success_url: `${process.env.CLIENT_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`, // {CHECKOUT_SESSION_ID} format by stripe API
        cancel_url: `${process.env.CLIENT_URL}/payment/cancel`,
      }
      let config = sessionConfigWithCustomer
      if(!customer_id){
        config = sessionConfigWithoutCustomer
        console.log("User checkout without login.");
      }
      const session = await stripe.checkout.sessions.create(config);

      // provide checkout url to client in res.data.url
      res.status(200).json({
        url:session.url,
        customer_id: session.customer
      });//res.redirect(303, session.url)

    } catch (error) {
      console.log(error);
      res.status(500).json({ error: error.message })
    }

});

router.get('/create-customer-id/:id', async (req,res) =>{
  
  try {
    const { id } = req.params
    const customer = await stripe.customers.create({
      metadata: {'_id': id}
    })
    res.status(200).json({customer})
  } catch (error) {
    res.status(500).json({msg:error})
  }

});

//#region 
// app.get('/success', async (req, res) => {
//  const session = 
//    await stripe.checkout.sessions.retrieve(req.query.session_id);
//  const customer = await stripe.customers.retrieve(session.customer);
// });
// success_url: "http://yoursite.com/order/success?session_id={CHECKOUT_SESSION_ID}"
//#endregion
router.get('/success', async (req,res) => {
  //TODO: Create endpoint (cs_id) => (line items array)
  // const session = await stripe.checkout.sessions.retrieve(req.query.session_id);
  // const customer = await stripe.customers.retrieve(session.customer);
  // console.log(customer);
  try {
    const paymentIntents = await stripe.paymentIntents.list({
      customer: req.query.customer_id
    });
    console.log(paymentIntents);

    res.json({paymentIntents})
    // const sessions = await stripe.checkout.sessions.list({
    //   payment_intent: "pi_3K0QGRDQmRUOrH2v2Wz2gxIY",
    // });

    // res.json({sessions})
  } catch (error) {
    console.error(error);
  }

  // res.send(`<html><body><h1>Thanks for your order, ${customer.name}!</h1></body></html>`);
});

router.get('/session-detail', async(req,res) => {
  // console.log(req.query.session_id);
  const { session_id } = req.query
  const session = await stripe.checkout.sessions.retrieve(session_id);
  if (session.payment_status==='paid'){
    redis.flushall() // invalidate cache if new payment made
    const updateCustomer = await stripe.customers.update(
      session.customer,
      {metadata: {latest_pi: session.payment_intent}}
    );
    // console.log(updateCustomer);
    const response = await stripe.checkout.sessions.listLineItems(session_id)
    
    res.status(200).json({line_items:response, session})
  } else {
    res.status(401).json({error:"Payment is not successful!", session:session});
  }
  
});
//#region session log
// {
//   id: 'cs_test_a1CaYQ1EcHbV99Oe8SefkFih4KaQjqRs5ipFYHOyWX2BRL2qtTRbcn9lJN',
//   object: 'checkout.session',
//   after_expiration: null,
//   allow_promotion_codes: null,
//   amount_subtotal: 100,
//   amount_total: 100,
//   automatic_tax: { enabled: false, status: null },
//   billing_address_collection: null,
//   cancel_url: 'http://localhost:3000/cancel',
//   client_reference_id: null,
//   consent: null,
//   consent_collection: null,
//   currency: 'sgd',
//   customer: 'cus_KeZlFK8hvhAviJ',
//   customer_details: {
//     email: 'nyhdid@gmail.com',
//     phone: null,
//     tax_exempt: 'none',
//     tax_ids: []
//   },
//   customer_email: null,
//   expires_at: 1637827990,
//   livemode: false,
//   locale: null,
//   metadata: {},
//   mode: 'payment',
//   payment_intent: 'pi_3JzGbKDQmRUOrH2v1FS9yFfW',
//   payment_method_options: {},
//   payment_method_types: [ 'card' ],
//   payment_status: 'paid',
//   phone_number_collection: { enabled: false },
//   recovered_from: null,
//   setup_intent: null,
//   shipping: null,
//   shipping_address_collection: null,
//   shipping_options: [],
//   shipping_rate: null,
//   status: 'complete',
//   submit_type: null,
//   subscription: null,
//   success_url:'SERVERURL/payment/success?session_id={CHECKOUT_SESSION_ID}',
//   total_details: { amount_discount: 0, amount_shipping: 0, amount_tax: 0 },
//   url: null,
// }
//#endregion

router.get('/purchase-history/:customer_id/:id', utils.authMiddleware , (req,res) => {
  const { customer_id, id } = req.params
  console.log("ID: " + id + " is used for verification");
  try {
    // const promise1 = Promise.resolve(3);
    // const promise2 = 42;
    // const promise3 = new Promise((resolve, reject) => {
    //   setTimeout(resolve, 100, 'foo');
    // });

    // Promise.all([promise1, promise2, promise3]).then((values) => {
    //   console.log(values);
    // });

    // let's say this is the API function with two callbacks,
    // one for success and the other for error
    // function apiFunction(query, successCallback, errorCallback) {
    //   if (query == "bad query") {
    //       errorCallback("problem with the query");
    //   }
    //   successCallback("Your query was <" + query + ">");
    // }

    // myFunction wraps the above API call into a Promise
    // and handles the callbacks with resolve and reject
    // function apiFunctionWrapper(query) {
    //   return new Promise((resolve, reject) => {
    //       apiFunction(query,(successResponse) => {
    //           resolve(successResponse);
    //       }, (errorResponse) => {
    //           reject(errorResponse);
    //       });
    //   });
    // }

    // now you can use await to get the result from the wrapped api function
    // and you can use standard try-catch to handle the errors
    // async function businessLogic() {
    //   try {
    //       const result = await apiFunctionWrapper("query all users");
    //       console.log(result); 
    //       // the next line will fail
    //       const result2 = await apiFunctionWrapper("bad query");
    //   } catch(error) {
    //       console.error("ERROR:" + error);
    //   }
    // }
    function getSessionsId(successPi) { 
      return Promise.all(successPi.map(async(pi) => {
        const sessions = await stripe.checkout.sessions.list({
          payment_intent: pi.id,
        })
        // console.log(sessions.data[0].id);
        return sessions.data[0].id
      }));
    }
    function getLineItems(successPi) {
      let promises = []
      successPi.forEach((sessionId) => {
        const promise = new Promise((resolve, reject) => {
          stripe.checkout.sessions.listLineItems(sessionId,(err, lineItems) => {
                if(!err){
                  resolve(lineItems.data);
                }else{
                  reject(err);
                }
            });
        });
        promises.push(promise)
      })
      return Promise.all(promises)
    }
    redis.get(customer_id, async (err, result) => {
      if(err) console.error(err); // redis connection error or other error
        
      if(result !== null) {       // redis cache found for this customer id
        console.log("Cache hit");
        const { success, receiptUrls, lineItems } = await JSON.parse(result)
        // console.log(result);
        res.status(200).json({ 
          success, 
          receiptUrls,
          lineItems,
        });

      } else {                    // cache not found/expired, init cache
        console.log("Cache missed.");
        // return .data [] for all intents 
        const paymentIntents = await stripe.paymentIntents.list({
          customer: customer_id
        })
        const { data } = paymentIntents
        // console.log(paymentIntents);
        const successPaymentIntents = data.filter( pi => 
          pi.amount_received > 0 // paid amount > 0
        )
        const receiptUrls = successPaymentIntents.map((pi)=>{
          return pi.charges.data[0].receipt_url
        })
        // console.log(successPaymentIntents);
        const sessionsId = await getSessionsId(successPaymentIntents)
        // console.log("sessionsId: ",sessionsId);
        const lineItemsArr = await getLineItems(sessionsId);

        const lineItemsData = await lineItemsArr.map((orderArr)=>{
          return orderArr.map((order)=>{
            return {
              description: order.description,
              total_amount: order.amount_total,
              unit_amount: order.price.unit_amount,
              created: order.price.created,
              quantity: order.quantity
            }
          })
        })

        const payload = {
          success: true, 
          receiptUrls,
          lineItems: lineItemsData
        }

        redis.setex(customer_id, DEFAULT_EXPIRATION, JSON.stringify(payload),   (err,result)=>{
          if(err) console.error(err)
          else console.log("Cache saved: ", result)
        });

        res.status(200).json({ 
          success: true, 
          receiptUrls,
          lineItems: lineItemsData
        });
        // lineItems = [orderArr,...]
        // orderArr=
        // {
        //   "amount_total": 500,
        //   "description": "Fried Rice",
        //   "price": {
        //       "created": 1638458418,
        //       "unit_amount": 250,
        //   },
        //   "quantity": 2
        // }       

      }
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error})
  }

});

// test ioredis functionality
 router.get('/redis', (req, res) => {
  const { flush, key, value, exp } = req.query;
  if(flush) {
    redis.flushall()
    res.json({msg:"Successfully flushed all data inside redis."})
  }else{
    // https://stackoverflow.com/questions/16375188/redis-strings-vs-redis-hashes-to-represent-json-efficiency


    if(key && value) {
      if(!exp) redis.set(key, value)
      else redis.setex(key, exp, value)

      const promise1 = redis.get(key, function (err, result) {
        if (err) {
          console.error(err);
        } else {
          console.log(`Get value of '${key}': `,result); 
          return result
        }
      });
    }

    const promise2 = redis.keys("*", function (err, result) {
      if (err) {
        console.error(err);
      } else {
        console.log("Get all keys: ",result); // Promise resolves to "bar"
        return result
      }
    });

    Promise.all([promise2]).then((value)=>{
      res.json({value})
    })
  }
});

module.exports = router;