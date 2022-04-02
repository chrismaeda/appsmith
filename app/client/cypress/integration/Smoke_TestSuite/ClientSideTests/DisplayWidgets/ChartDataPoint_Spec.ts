import { ObjectsRegistry } from "../../../../support/Objects/Registry"

let dataSet: any, dsl: any;
let agHelper = ObjectsRegistry.AggregateHelper,
    ee = ObjectsRegistry.EntityExplorer,
    jsEditor = ObjectsRegistry.JSEditor,
    locator = ObjectsRegistry.CommonLocators;

describe("Input widget test with default value from chart datapoint", () => {

    before(() => {
        cy.fixture('ChartDsl').then((val: any) => {
            agHelper.AddDsl(val)
            dsl = val;
        });
        cy.fixture("testdata").then(function (data: any) {
            dataSet = data;
        });
    });

    it("1. Input widget test with default value from another Input widget", () => {
        ee.expandCollapseEntity("WIDGETS")
        ee.SelectEntityByName("Input1")
        jsEditor.EnterJSContext("defaulttext", dataSet.bindChartData + "}}");
        agHelper.ValidateNetworkStatus('@updateLayout')
    });

    it("2. Chart with datapoint feature validation", function () {
        ee.SelectEntityByName("Chart1")
        agHelper.SelectPropertiesDropDown("ondatapointclick", "Show message")
        agHelper.EnterActionValue("Message", dataSet.bindingDataPoint)
        agHelper.XpathNClick("(//*[local-name()='rect'])[13]")
        cy.get(locator._inputWidget).first().invoke('val').then($value => {
            let inputVal = ($value as string).replace(/\s/g, "")
            //cy.get(locator._toastMsg).invoke('text').then(toastTxt => expect(toastTxt.trim()).to.eq(inputVal))
            cy.get(locator._toastMsg).should('have.text', inputVal)
        })
    })

    it("3. Chart with seriesTitle feature validation", function () {
        ee.SelectEntityByName("Input2")
        jsEditor.EnterJSContext("defaulttext", dataSet.bindingSeriesTitle + "}}");
        cy.get(locator._inputWidget).last().should("have.value", dsl.dsl.children[0].chartData[0].seriesName);
    });

});