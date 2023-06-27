# copy this to your server and run to extract credentials required to access the instances from the admin service api here

echo "["
for D in *; do
        if [ -d "${D}" ] && [[ $D == ndb-* ]]; then
                cd "$D";
                if [ -f ".env" ]
                then
                        pw=$(cat .env)
                        pw=${pw#*COUCHDB_PASSWORD=}
                else
                        pw=$(cat docker-compose.yml)
                        pw=${pw#*COUCHDB_PASSWORD:[[:space:]]}
                fi
                pw=${pw%%[[:space:]]*}
                cd ..
                
                if [[ $pw == "version:" ]]; then continue; fi
                echo "{ \"name\": \"${D#*ndb-}\", \"password\": \"$pw\" },"
        fi
done
echo "]"

