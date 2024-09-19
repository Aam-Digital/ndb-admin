import {Injectable} from '@nestjs/common';
import {Couchdb} from "../couchdb.service";
import {BulkUpdateDto} from "../bulk-update.dto";

@Injectable()
export class SearchAndReplaceService {
    async bulkUpdateAssign(couchdb: Couchdb, bulkUpdate: BulkUpdateDto) {
        const docs = await couchdb.post('/app/_find', {
            selector: bulkUpdate.query,
            skip: 0,
            limit: 100000,
        });

        return Promise.all(
            docs.map((doc) => {
                const update = Object.assign(doc, bulkUpdate.replace);
                return couchdb.put(`/app/${doc._id}`, update);
            }),
        );
    }

    /**
     * Find all entities (with the given ID or ID prefix) that match the search term.
     * @param couchdb
     * @param searchString regex to search for
     * @param type _id or prefix (entity type) to identify the documents to search upon
     */
    async searchInEntities(couchdb: Couchdb, searchString: string, type: string) {
        const docs = await couchdb.getAll(type);
        const filterDocMatchingRegex = this.getFilterFunction_DocMatchingRegex(searchString);
        return docs
            .filter((doc) => filterDocMatchingRegex(doc))
            .map((doc) => ({ _id: doc._id, match: filterDocMatchingRegex(doc) }) );
    }

    private getFilterFunction_DocMatchingRegex(searchString: string) {
        const regex = new RegExp(searchString, 'g');
        return (doc) => {
            const docString = JSON.stringify(doc);
            return docString.match(regex);
        };
    }

    async replaceInEntities(couchdb: Couchdb, searchString: string, replaceString: string, type: string) {
        const docs = await couchdb.getAll(type);
        const regex = new RegExp(searchString, 'g');
        const filterDocMatchingRegex = this.getFilterFunction_DocMatchingRegex(searchString);
        return Promise.all(docs
            .filter((doc) => filterDocMatchingRegex(doc))
            .map(async (doc) => {
                const docString = JSON.stringify(doc);
                const replaced = docString.replace(regex, replaceString);

                const path = '/app/' + doc._id;
                await couchdb.put(path, JSON.parse(replaced));
                return { _id: doc._id };
            }));
    }
}
