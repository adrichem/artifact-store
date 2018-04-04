# artifact-store: Storage for artifacts like videos, logs and screenshots. 

Post a multipart file upload to the / endpoint and the 'artifact-store' does the following:
1. Saves each file on Azure Blobstorage. 
1. Generates metadata for each file (url, originalname, mime-type)
1. If you included a key called 'metadata' in the form, its content is treated as a JSON object and included in the metadata.
1. Stores the metadata on Azure Blobstorage.
1. Sends the metadata to Elasticsearch for indexing.

You can use it from a docker-compose file like this:
```
version: '2'

networks:
     grid:

services:
  artifact-store:
    image: artifact-store:latest
    ports: 
    - 4000:4000
    restart: always
    networks:
      grid:
        aliases:
        - artifact-store
    command: > 
      npm start --
        --port 4000 
        --connection https://<youraccounthere>.blob.core.windows.net/ 
        --key <yourkeyhere>
        --account <youraccounthere>
        --container artifacts
        --metadataContainer metadata
        --indexer http://elasticsearch:9200/artifacts/artifact
      
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch-oss:6.1.2
    ports: 
      - 9200:9200
      - 9300:9300
    restart: always
    environment:
      - discovery.type=single-node
    networks:
      grid:
        aliases:
        - elasticsearch

  kibana:
    image: docker.elastic.co/kibana/kibana-oss:6.1.2
    ports: 
      - 5601:5601
    restart: always
    environment:
      ELASTICSEARCH_URL: http://elasticsearch:9200
      xpack.security.enabled: "false"
    networks:
      grid:
        aliases:
        - kibana
  
  zalenium:
    image: adrichem/zalenium-artifact-store:3.8.1j
    ports:
    - 4444:4444
    - 5555:5555
    volumes:
    - /var/run/docker.sock:/var/run/docker.sock
    environment:
      - REMOTE_DASHBOARD_HOST=http://artifact-store:4000
    restart: always
    command: >
      start --seleniumImageName elgalu/selenium:3.8.1-p7  
        --screenWidth 1920
        --screenHeight 1080
        --videoRecordingEnabled false
    networks:
      grid:
        aliases:
        - zalenium-node1
