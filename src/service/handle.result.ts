import { Injectable } from "@nestjs/common";
import { CameoService } from "./cameo.service";
import { IntegratedService } from "./integrated.service";

@Injectable()
export class ScraperService {
    constructor(
        private readonly cameoService: CameoService,
        private readonly integratedService: IntegratedService,
    ) {}
    
    async getAllotment(
        pancardNumber: string,
        allotmentCompanyCode: string,
        registrarNum: number,
        allotmentUrl: string,
        registrarWebsite: string,
    ) {
        switch (registrarNum) {
            case 1:
                return await this.cameoService.getAllotment(pancardNumber, allotmentCompanyCode, allotmentUrl);
            case 2:
                return await this.integratedService.getAllotment(pancardNumber, allotmentCompanyCode, registrarWebsite, allotmentUrl);
        }
    }
}