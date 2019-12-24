const fs = require('fs');
const express = require('express');
const router = express.Router();
const url = require('url');
const verifyCall = require('../tools/verify');
const request = require('request-promise');
// trying to find a way to catch the access token and 
// store it in .env file

// const envContent = fs.readFileSync('../.env')
// console.log(envContent);

//upload image section
const multer = require('multer');
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, './nodeapp/public/uploads/');
    },
    filename: function (req, file, cb) {



        cb(null, file.originalname);
    }
});
const imageFilter = function (req, file, cb) {
    if (!file.originalname.match(/\.(jpg|png|gif|PNG|JPG|jpeg|JPEG)$/)) {
        return cb(new Error('Only image files are allowed.'), false);
    }
    cb(null, true);
};
const limit = { fileSize: 8000000 };

const upload = multer({ storage: storage, limits: limit, fileFilter: imageFilter }).array('file', 50);
//end upload image section

router.get('/install', function (req, res, next) {
    const shop = req.query.shop;
    const appId = process.env.appId;
    const appSecret = process.env.appSecret;
    const appScope = process.env.appScope;
    const appDomain = process.env.appDomain;

    //build the url
    const installUrl = `https://${shop}/admin/oauth/authorize?client_id=${appId}&scope=${appScope}&redirect_uri=${appDomain}/shopify/auth`;
    res.redirect(installUrl);
    // if (process.env.appStoreTokenTest.length > 0) {
    //     // if token already exists
    //     res.redirect(`/shopify/app?shop=${shop}`);
    // } else {
    //     // if you don't have the token yet
    //     res.redirect(installUrl);
    // }

});

router.get('/auth', function (req, res, next) {
    let securityPass = false;
    let appId = process.env.appId;
    let appSecret = process.env.appSecret;
    let shop = req.query.shop;
    let code = req.query.code;


    const regex = /^[a-z\d_.-]+[.]myshopify[.]com$/;

    if (shop.match(regex)) {
        console.log('regex is ok');
        securityPass = true;
    } else {
        //exit
        securityPass = false;
    }

    // 1. Parse the string URL to object
    let urlObj = url.parse(req.url);
    // 2. Get the 'query string' portion
    let query = urlObj.search.slice(1);
    if (verifyCall.verify(query)) {
        //get token
        console.log('get token');
        securityPass = true;
    } else {
        //exit
        securityPass = false;
    }

    if (securityPass && regex) {

        //Exchange temporary code for a permanent access token
        let accessTokenRequestUrl = `https://${shop}/admin/oauth/access_token`;
        let accessTokenPayload = {
            client_id: appId,
            client_secret: appSecret,
            code,
        };

        request.post(accessTokenRequestUrl, { json: accessTokenPayload })
            .then((accessTokenResponse) => {
                let accessToken = accessTokenResponse.access_token;
                console.log('shop token ' + accessToken);
                 // find a way to add the token to
                 // .env file
                res.redirect('/shopify/app?shop=' + shop);
            })
            .catch((error) => {
                res.status(error.statusCode).send(error.error.error_description);
            });
    }
    else {
        res.redirect('/installerror');
    }

});


router.get('/app', function (req, res, next) {
    let shop = req.query.shop;
    res.render('app', { shop: shop });
});
router.post('/app/inventorySyncCreate', (req, res)=>{
    let new_product = req.body;
    let url = 'https://crisp-shop2.myshopify.com/admin/api/2019-10/products.json';
    let options = {
            method: 'POST',
            uri: url,
            json: true,
            resolveWithFullResponse: true,//added this to view status code
            headers: {
                'X-Shopify-Access-Token': process.env.appStoreTokenTest,
                'content-type': 'application/json'
            },
            body: {
                product: new_product//pass new product object - NEW - request-promise problably updated
                }
            };

        request.post(options) //use the "request-promise" to create a new product
        .then(response =>{
            if(response.statusCode === 201){
                res.status(201).send('Product add was successful')
            }
            else{
                res.status(400).send('Something went wrong')
            }
        })
        .catch( err =>{
            console.error(err)
        })
    
})
router.post('/app/inventorySyncUpdate', (req, res)=>{
    // testing to update inventory level for the first Product Variant 
    const product_id = req.body.id; // Product Id
    const products_update = req.body.variants; // Array of Product Variants
    const available = req.body.variants[0].inventory_quantity; //First Product Qty to use for the update
    console.log(product_update)
    // Step 1: Query a variant for to find the id 
    // of its inventory item 
    
        let url1 = `https://crisp-shop2.myshopify.com/admin/api/2019-10/products/${req.body.variants[0].product_id}/variants/${req.body.variants[0].id}.json`;
        let url_il_1 = `https://crisp-shop2.myshopify.com/admin/api/2019-10/inventory_levels.json?inventory_item_ids=${inventory_item_id}`
        
            request(url1).then(response=>{// request made to get inventory_item_id
            const inventory_item_id = response.inventory_item_id;
            request(url_il_1).then(response =>{// request made to get location_id
            const location_id = response.inventory_levels[0].location_id;
            
            let url_set_il_1 = `https://crisp-shop2.myshopify.com/admin/api/2019-10/inventory_levels/set.json`
            let options = {
                method: 'POST',
                uri: url_set_il_1,
                json: true,
                resolveWithFullResponse: true,//added this to view status code
                headers: {
                    'X-Shopify-Access-Token': process.env.appStoreTokenTest,
                    'content-type': 'application/json'
                },
                body: {
                    location_id, 
                    inventory_item_id,
                    available
                    }
                };
                request(options).then(response =>{// request made to update the first product
                    console.log(response.statusCode)
                    res.status(200).send('update successful')
            })
            .catch(err=> console.error(err))
            }).catch(err=> console.error(err))
        }).catch(err=> console.error(err))
    })

    // This is what I attempted first to get the update to work
    //
    // let url = `https://crisp-shop2.myshopify.com/admin/api/2019-10/products/#${req.body.id}.json`;
    
    // let options = {
    //     method: 'PUT',
    //     uri: url,
    //     json: true,
    //     resolveWithFullResponse: true,//added this to view status code
    //     headers: {
    //         'X-Shopify-Access-Token': process.env.appStoreTokenTest,
    //         'content-type': 'application/json'
    //     },
    //     body: {
    //         product: product_update
    //         }
    //     };

    //     request.put(options) //use the "request-promise" to create a new product
    //     .then(response =>{
    //         console.log(response.statusCode, response.status)
    //         if(response.statusCode === 200){
    //             res.status(200).send('Product update was successful')
    //         }
    //         else{
    //             res.status(400).send('Something went wrong')
    //         }
    //     })
    //     .catch( err =>{
    //         console.error(err)
    //     })

router.post('/app/file-upload', function (req, res, next) {

    try {
        upload(req, res, function (err) {

            if (err) {
                if (err.code == 'LIMIT_FILE_SIZE') {
                    console.log(err);
                    res.status(413).json({ error: err.message });
                } else {
                    console.log(err);
                    res.status(413).json({ error: err.message });
                }
            } else {
                //upload to Shopify
                console.log(req.query.filename);


                let url = 'https://' + req.query.shop + '/admin/products/' + req.query.id + '.json';

                let update_product = {
                    product: {
                        id: req.query.id,
                        images: [
                            {
                                src: 'https://' + process.env.appDomain + '/uploads/' + req.query.filename
                            }
                        ]
                    }
                };

                let options = {
                    method: 'PUT',
                    uri: url,
                    json: true,
                    resolveWithFullResponse: true,//added this to view status code
                    headers: {
                        'X-Shopify-Access-Token': process.env.appStoreTokenTest,
                        'content-type': 'application/json'
                    },
                    body: update_product
                };

                request.put(options)
                    .then(function (response) {
                        console.log(response.body);
                        if (response.statusCode == 200) {
                            res.send({ message: 'uploaded' });
                        } else {
                            res.send({ message: 'fail to upload' });
                        }

                    })
                    .catch(function (err) {
                        console.log(err);
                        res.send({ message: 'error' });
                    });

            }

        });
    } catch (error) {
        console.log(error);
    }


});

router.post('/app/delete', function (req, res) {

    let url = 'https://' + req.query.shop + '/admin/products/' + req.query.id + '.json';

    let options = {
        method: 'DELETE',
        uri: url,
        resolveWithFullResponse: true,//added this to view status code
        headers: {
            'X-Shopify-Access-Token': process.env.appStoreTokenTest,
            'content-type': 'application/json'
        }
    };

    request.delete(options)
        .then(function (response) {
            console.log(response.body);
            if (response.statusCode == 200) {
                res.json(true);
            } else {
                res.json(false);
            }

        })
        .catch(function (err) {
            console.log(err);
            res.json(false);
        });
});
router.get('/app/products', function (req, res, next) {

    let url = 'https://' + req.query.shop + '/admin/products.json';

    let options = {
        method: 'GET',
        uri: url,
        json: true,
        headers: {
            'X-Shopify-Access-Token': process.env.appStoreTokenTest,
            'content-type': 'application/json'
        }
    };

    request(options)
        .then(function (parsedBody) {
            console.log(parsedBody);
            res.json(parsedBody);
        })
        .catch(function (err) {
            console.log(err);
            res.json(err);
        });


});


module.exports = router;