import { Injectable } from '@angular/core';
import { ApiService } from '../../../core/services/api.service';

@Injectable({
    providedIn: 'root'
})
export class CompanyService {
    constructor(private api: ApiService) { }

    // Company specific data fetching...
}
