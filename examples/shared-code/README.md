# Shared Code Example #

This example demonstrates how to use the same input validation code on
the server-side and client-side of a website. Visitors with javascript
enabled benefit from the responsiveness of in-browser validation. The
server enforces the same validation policy as the client, keeping
things consistent and DRY.

## Files ##

+ app.js :: Node/Express webserver
+ public/js/main.js :: client-side validation
+ public/js/validation.js :: shared code

