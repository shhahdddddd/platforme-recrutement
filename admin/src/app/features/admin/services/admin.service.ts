import { Injectable } from '@angular/core';
import { ApiService } from '../../../core/services/api.service';

@Injectable({
    providedIn: 'root'
})
export class AdminService {
    constructor(private api: ApiService) { }

    // Admin specific data fetching...
}
