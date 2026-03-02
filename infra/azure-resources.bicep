param location string = resourceGroup().location
param appName string = 'edu-rot-pipeline'

// Storage Account
resource storageAccount 'Microsoft.Storage/storageAccounts@2022-09-01' = {
  name: 'st${uniqueString(resourceGroup().id)}'
  location: location
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    accessTier: 'Hot'
  }
}

// Blob Containers
resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2022-09-01' = {
  parent: storageAccount
  name: 'default'
}

resource videoContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2022-09-01' = {
  parent: blobService
  name: 'background-videos'
}

resource outputContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2022-09-01' = {
  parent: blobService
  name: 'processed-videos'
}

resource dataContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2022-09-01' = {
  parent: blobService
  name: 'export-data'
}

// AI Speech Service
resource speechService 'Microsoft.CognitiveServices/accounts@2022-12-01' = {
  name: 'speech-${uniqueString(resourceGroup().id)}'
  location: location
  kind: 'SpeechServices'
  sku: {
    name: 'S0'
  }
  properties: {
    apiProperties: {
      statisticsEnabled: false
    }
  }
}

// App Service Plan (Linux)
resource appServicePlan 'Microsoft.Web/serverfarms@2022-09-01' = {
  name: 'plan-${appName}'
  location: location
  kind: 'linux'
  sku: {
    name: 'B1' // Cheaper/Allowed for Student accounts
  }
  properties: {
    reserved: true
  }
}

// Web App
resource webApp 'Microsoft.Web/sites@2022-09-01' = {
  name: appName
  location: location
  properties: {
    serverFarmId: appServicePlan.id
    siteConfig: {
      linuxFxVersion: 'NODE|18-lts'
      appSettings: [
        {
          name: 'AZURE_STORAGE_CONNECTION_STRING'
          value: 'DefaultEndpointsProtocol=https;AccountName=${storageAccount.name};AccountKey=${storageAccount.listKeys().keys[0].value};EndpointSuffix=${environment().suffixes.storage}'
        }
        {
          name: 'AZURE_SPEECH_KEY'
          value: speechService.listKeys().key1
        }
        {
          name: 'AZURE_SPEECH_REGION'
          value: location
        }
        {
          name: 'NODE_ENV'
          value: 'production'
        }
      ]
    }
  }
}

output storageAccountName string = storageAccount.name
output speechServiceName string = speechService.name
output webAppUrl string = webApp.properties.defaultHostName
