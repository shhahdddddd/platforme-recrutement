const axios = require('axios');

// Configuration
const KEYCLOAK_URL = 'http://localhost:8080';
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'admin';
const REALM_NAME = 'recrutement';
const CLIENT_ID = 'recrutement-api';
async function setupKeycloak() {
    try {
        console.log('🔄 Connecting to Keycloak...');

        // 1. Get Admin Token
        const tokenResponse = await axios.post(`${KEYCLOAK_URL}/realms/master/protocol/openid-connect/token`, new URLSearchParams({
            client_id: 'admin-cli',
            grant_type: 'password',
            username: ADMIN_USERNAME,
            password: ADMIN_PASSWORD
        }), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        const accessToken = tokenResponse.data.access_token;
        console.log('✅ Admin authenticated successfully');

        const headers = {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        };

        // 2. Check if Realm exists
        try {
            await axios.get(`${KEYCLOAK_URL}/admin/realms/${REALM_NAME}`, { headers });
            console.log(`ℹ️  Realm '${REALM_NAME}' already exists.`);
        } catch (error) {
            if (error.response && error.response.status === 404) {
                console.log(`Creating realm '${REALM_NAME}'...`);
                await axios.post(`${KEYCLOAK_URL}/admin/realms`, {
                    realm: REALM_NAME,
                    enabled: true,
                    registrationAllowed: true
                }, { headers });
                console.log(`✅ Realm '${REALM_NAME}' created`);
            } else {
                throw error;
            }
        }

        // 3. Create Client
        console.log(`Checking client '${CLIENT_ID}'...`);
        const clientsResponse = await axios.get(`${KEYCLOAK_URL}/admin/realms/${REALM_NAME}/clients?clientId=${CLIENT_ID}`, { headers });
        let client = clientsResponse.data.length > 0 ? clientsResponse.data[0] : null;

        if (!client) {
            console.log(`Creating client '${CLIENT_ID}'...`);
            await axios.post(`${KEYCLOAK_URL}/admin/realms/${REALM_NAME}/clients`, {
                clientId: CLIENT_ID,
                enabled: true,
                publicClient: true, // Use public client for frontend apps (Change to false if using client secret)
                directAccessGrantsEnabled: true, // Allow username/password flow
                standardFlowEnabled: true,
                redirectUris: ['*'],
                webOrigins: ['*']
            }, { headers });
            console.log(`✅ Client '${CLIENT_ID}' created`);

            // Fetch the created client
            const newClientsResponse = await axios.get(`${KEYCLOAK_URL}/admin/realms/${REALM_NAME}/clients?clientId=${CLIENT_ID}`, { headers });
            client = newClientsResponse.data[0];
        } else {
            console.log(`ℹ️  Client '${CLIENT_ID}' already exists.`);
            // Update client to ensure direct access grants are enabled
            if (!client.directAccessGrantsEnabled) {
                await axios.put(`${KEYCLOAK_URL}/admin/realms/${REALM_NAME}/clients/${client.id}`, {
                    ...client,
                    directAccessGrantsEnabled: true,
                    publicClient: true,
                    redirectUris: ['*'],
                    webOrigins: ['*']
                }, { headers });
                console.log(`✅ Client '${CLIENT_ID}' updated to enable Direct Access Grants`);
            }
        }

        // 4. Create Roles
        const roles = ['admin', 'company', 'candidate', 'recruiter'];
        for (const roleName of roles) {
            try {
                await axios.post(`${KEYCLOAK_URL}/admin/realms/${REALM_NAME}/roles`, {
                    name: roleName
                }, { headers });
                console.log(`✅ Role '${roleName}' created`);
            } catch (e) {
                if (e.response && e.response.status === 409) {
                    // Role exists, ignore
                } else {
                    console.error(`Error creating role ${roleName}:`, e.message);
                }
            }
        }

        // 5. Create Test User
        console.log(`Checking user '${USER_EMAIL}'...`);
        const usersResponse = await axios.get(`${KEYCLOAK_URL}/admin/realms/${REALM_NAME}/users?email=${USER_EMAIL}`, { headers });
        let user = usersResponse.data.length > 0 ? usersResponse.data[0] : null;

        if (!user) {
            console.log(`Creating user '${USER_EMAIL}'...`);
            const createUserResponse = await axios.post(`${KEYCLOAK_URL}/admin/realms/${REALM_NAME}/users`, {
                username: USER_EMAIL,
                email: USER_EMAIL,
                enabled: true,
                emailVerified: true,
                firstName: 'Test',
                lastName: 'Company',
                credentials: [{
                    type: 'password',
                    value: USER_PASSWORD,
                    temporary: false
                }],
                attributes: {
                    role: 'company' // Custom attribute used by backend
                }
            }, { headers });

            // Get the new user ID
            const usersResp = await axios.get(`${KEYCLOAK_URL}/admin/realms/${REALM_NAME}/users?email=${USER_EMAIL}`, { headers });
            user = usersResp.data[0];

            console.log(`✅ User '${USER_EMAIL}' created with password '${USER_PASSWORD}'`);
        } else {
            console.log(`ℹ️  User '${USER_EMAIL}' already exists.`);
            // Reset password just in case
            await axios.put(`${KEYCLOAK_URL}/admin/realms/${REALM_NAME}/users/${user.id}/reset-password`, {
                type: 'password',
                value: USER_PASSWORD,
                temporary: false
            }, { headers });
            console.log(`✅ Password reset for '${USER_EMAIL}' to '${USER_PASSWORD}'`);
        }

        // 6. Assign Role to User
        // Get role representation
        const roleName = 'company';
        const roleResp = await axios.get(`${KEYCLOAK_URL}/admin/realms/${REALM_NAME}/roles/${roleName}`, { headers });
        if (roleResp.data && user) {
            await axios.post(`${KEYCLOAK_URL}/admin/realms/${REALM_NAME}/users/${user.id}/role-mappings/realm`, [roleResp.data], { headers });
            console.log(`✅ Role '${roleName}' assigned to user '${USER_EMAIL}'`);
        }

        console.log('\n🎉 Keycloak setup complete!');
        console.log('You can now log in with:');
        console.log(`Email: ${USER_EMAIL}`);
        console.log(`Password: ${USER_PASSWORD}`);

    } catch (error) {
        console.error('❌ Setup failed:', error.response ? error.response.data : error.message);
        if (error.code === 'ECONNREFUSED') {
            console.error('Check if Keycloak is running at ' + KEYCLOAK_URL);
        }
    }
}

setupKeycloak();
