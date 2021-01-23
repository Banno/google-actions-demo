# google-actions-demo

Integrate Banno's Consumer API with Google Assistant. Users can link their accounts to Google and
ask questions about their account balances.

This is designed as a basic demonstration utilizing Banno's Consumer API.

[![Demonstration Video](http://img.youtube.com/vi/e6pue3O0Ovg/0.jpg)](http://www.youtube.com/watch?v=e6pue3O0Ovg "Google Actions Demo - Garden Bank")

## Getting this project up and running for your institution

Make sure to reference the [Google Actions Builder documentation](https://developers.google.com/assistant/conversational/overview)

 1. Fork the code so that you can make your own changes and still keep up with any changes we push here.
 2. Create a Google Actions project by visiting https://console.actions.google.com/
 3. Visit the [Google Cloud Console](https://console.cloud.google.com/) and link a billing
     account to your project. While you are there, enable the Cloud Functions API, Cloud Build API
     and Cloud Logging API.
 4. Get your project id from the [Google Actions portal](https://console.actions.google.com/) under
     the project settings page. It's hidden under the 3 dots menu in the top right. You'll need
     this for quite a few things.
 5. Create a set of OAuth credentials by visiting [Banno People](https://banno.com/a/people).
     This is configured in the "Settings" area under "External Applications".
     - Name the application "Google"
     - Create a "Confidential" client
     - Ensure the "User consent required" option is selected
     - Add 2 redirect uris utilizing the project id from step 4:
       1. https://oauth-redirect.googleusercontent.com/r/PROJECT-ID
       2. https://oauth-redirect-sandbox.googleusercontent.com/r/PROJECT-ID
 6. Make sure you have the
     [gactions command line tool](https://developers.google.com/assistant/conversational/quickstart)
     installed
 7. Modify the [settings/settings.yaml file](./settings/settings.yaml):
     - Set the `appClientId` value to the client id from your OAuth credentials
     - Update the banno online hostname in the `authorizationUrl` and `tokenUrl`
     - Set the `projectId` to your project id from step 4
 8. Update the
     [webhooks/actions_on_google_fulfillment/index.js file](webhooks/actions_on_google_fulfillment/index.js)
     - Update the `institutionId` and `bannoOnlineHostname` variables
 9. Use the gactions cli tool to set and encrypt your client secret from your OAuth credentials:
     `gactions encrypt`.
 10. Use the gactions cli to push and deploy your code: `gactions push` and `gactions deploy preview`.
 
You should now be able to test your project using the simulator in the
[Google Actions portal](https://console.actions.google.com/). Follow instructions in the sample
projects and getting started guides in the
[Google Actions Builder documentation](https://developers.google.com/assistant/conversational/overview)
for further changes.

Make sure to use `gactions pull` to update your local copy from the portal and commit the changes
back to your source control repository.
